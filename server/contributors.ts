// "What's contributing to your limits usage?" — a local, cost-weighted replica of
// the breakdown the Claude Code CLI shows under its usage view. Every figure is a
// *share of estimated cost* (dollars, via pricing.ts), not a token or call count,
// matching the CLI: `pct = round(behavior.cost / totalCost * 100)`, shown only when
// pct >= SHOW_PCT. Two independent windows (Day = last 24h, Week = last 7d).
//
// Thresholds are taken verbatim from the CLI: context > 150k, 4+ parallel sessions,
// sessions active 8+ hours, >=10% to surface. A few attributions are necessarily
// approximated from local transcripts (noted inline) since the CLI's per-request
// attribution tags aren't recoverable from the logs on disk.

import type { UsageEvent } from './scan.ts';
import type { InsightsData } from './insights-scan.ts';
import { estimateCost } from './pricing.ts';

const DAY_MS = 24 * 3600_000;
const WEEK_MS = 7 * DAY_MS;

const SHOW_PCT = 10; // CLI: hlr / A4o — a behavior surfaces only at >=10% of cost
const CTX_THRESHOLD = 150_000; // CLI: b8f — ">150k context"
const PARALLEL_MIN = 4; // CLI: m5l — "4+ sessions ran in parallel"
const CRON_MS = 8 * 3600_000; // CLI: sessions "active for 8+ hours"
const TOP_N = 8; // rows kept per breakdown table

export interface ContribBehavior {
  key: 'long_context' | 'subagent_heavy' | 'high_parallel' | 'cron';
  headline: string;
  body: string;
  pct: number;
}
export interface ContribRow {
  name: string;
  pct: number;
}
export interface ContribWindow {
  totalCost: number;
  requestCount: number;
  sessionCount: number;
  behaviors: ContribBehavior[];
  subagents: ContribRow[];
  mcpServers: ContribRow[];
  skills: ContribRow[];
  plugins: ContribRow[];
}
export interface ContributorsData {
  day: ContribWindow;
  week: ContribWindow;
}

const BEHAVIOR_BODY: Record<ContribBehavior['key'], string> = {
  long_context:
    'Longer sessions are more expensive even when cached. /compact mid-task, /clear when switching to new tasks.',
  subagent_heavy:
    'Each subagent runs its own requests. Be deliberate about spawning them — and consider configuring a cheaper model for simpler subagents.',
  high_parallel:
    "All sessions share one limit. If you don't need them all at once, queueing uses it more evenly.",
  cron:
    'These are often background/loop sessions. Continuous usage can add up quickly so make sure it is intentional.',
};

function headlineFor(key: ContribBehavior['key'], pct: number): string {
  switch (key) {
    case 'long_context':
      return `${pct}% of your usage was at >150k context`;
    case 'subagent_heavy':
      return `${pct}% of your usage came from subagent-heavy sessions`;
    case 'high_parallel':
      return `${pct}% of your usage was while 4+ sessions ran in parallel`;
    case 'cron':
      return `${pct}% of your usage came from sessions active for 8+ hours`;
  }
}

/** `mcp__<server>__<tool>` → `<server>` (null for non-MCP tools). */
function mcpServerOf(toolName: string): string | null {
  if (!toolName.startsWith('mcp__')) return null;
  const rest = toolName.slice(5);
  const server = rest.split('__')[0];
  return server || null;
}

/** Map → sorted [{name, pct}] (desc, pct>0), mirroring the CLI's flr(). */
function toRows(map: Map<string, number>, total: number): ContribRow[] {
  if (total <= 0) return [];
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, cost]) => ({ name, pct: Math.round((cost / total) * 100) }))
    .filter((r) => r.pct > 0)
    .slice(0, TOP_N);
}

function addTo(map: Map<string, number>, key: string, cost: number): void {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + cost);
}

/** Active-session count at any ts, from top-level session intervals (sweep line). */
function makeConcurrency(intervals: Array<[number, number]>): (ts: number) => number {
  const bounds: Array<[number, number]> = [];
  for (const [start, end] of intervals) {
    bounds.push([start, 1]);
    bounds.push([end, -1]);
  }
  bounds.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const times: number[] = [];
  const counts: number[] = [];
  let cur = 0;
  for (const [t, d] of bounds) {
    cur += d;
    times.push(t);
    counts.push(cur);
  }
  return (ts: number): number => {
    // last boundary with time <= ts
    let lo = 0;
    let hi = times.length - 1;
    let idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= ts) {
        idx = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return idx >= 0 ? counts[idx] : 0;
  };
}

function buildWindow(
  events: UsageEvent[],
  topLevelOf: (sessionId: string) => string,
  isHeavyTop: (topLevelId: string) => boolean,
  subagentTypeOf: (sessionId: string) => string,
): ContribWindow {
  // Per top-level session group: cost, first/last ts (for cron 8h + parallel).
  const topDur = new Map<string, { first: number; last: number }>();
  for (const e of events) {
    const tl = topLevelOf(e.sessionId);
    const d = topDur.get(tl);
    if (d) {
      if (e.ts < d.first) d.first = e.ts;
      if (e.ts > d.last) d.last = e.ts;
    } else topDur.set(tl, { first: e.ts, last: e.ts });
  }
  const activeAt = makeConcurrency([...topDur.values()].map((d) => [d.first, d.last]));

  let totalCost = 0;
  let longCtx = 0;
  let subagentHeavy = 0;
  let highParallel = 0;
  let cron = 0;

  const byMcp = new Map<string, number>();
  const bySubagent = new Map<string, number>();
  const bySkill = new Map<string, number>();
  const byPlugin = new Map<string, number>();
  const sessions = new Set<string>();

  for (const e of events) {
    const cost = estimateCost(e.model, e);
    if (cost <= 0) continue;
    totalCost += cost;
    const tl = topLevelOf(e.sessionId);
    sessions.add(tl);

    // Behaviors (each an independent characteristic — shares can overlap). These
    // are attributed at the *top-level session* grain: a session that spawned
    // subagents counts its whole cost (orchestrator + children) as subagent-heavy,
    // and a long-running orchestrator's whole cost counts as cron.
    const contextTokens = e.inputTokens + e.cacheReadTokens + e.cacheCreateTokens;
    if (contextTokens > CTX_THRESHOLD) longCtx += cost;
    if (isHeavyTop(tl)) subagentHeavy += cost;
    if (activeAt(e.ts) >= PARALLEL_MIN) highParallel += cost;
    const dur = topDur.get(tl);
    if (dur && dur.last - dur.first >= CRON_MS) cron += cost;

    // Breakdowns.
    const seenServers = new Set<string>();
    for (const t of e.tools) {
      const server = mcpServerOf(t);
      if (server && !seenServers.has(server)) {
        seenServers.add(server);
        addTo(byMcp, server, cost);
      }
    }
    if (e.isSidechain) addTo(bySubagent, subagentTypeOf(e.sessionId), cost);
    for (const skill of e.skills) {
      addTo(bySkill, skill, cost);
      const sep = skill.indexOf(':');
      if (sep > 0) addTo(byPlugin, skill.slice(0, sep), cost); // `plugin:skill`
    }
  }

  const behaviors: ContribBehavior[] = (
    [
      ['long_context', longCtx],
      ['subagent_heavy', subagentHeavy],
      ['high_parallel', highParallel],
      ['cron', cron],
    ] as Array<[ContribBehavior['key'], number]>
  )
    .map(([key, cost]) => ({
      key,
      pct: totalCost > 0 ? Math.round((cost / totalCost) * 100) : 0,
    }))
    .filter((b) => b.pct >= SHOW_PCT)
    .sort((a, b) => b.pct - a.pct)
    .map((b) => ({ key: b.key, pct: b.pct, headline: headlineFor(b.key, b.pct), body: BEHAVIOR_BODY[b.key] }));

  return {
    totalCost,
    requestCount: events.length,
    sessionCount: sessions.size,
    behaviors,
    subagents: toRows(bySubagent, totalCost),
    mcpServers: toRows(byMcp, totalCost),
    skills: toRows(bySkill, totalCost),
    plugins: toRows(byPlugin, totalCost),
  };
}

export function buildContributors(
  events: UsageEvent[],
  insights: InsightsData,
  now: number,
): ContributorsData {
  // agentId → subagent type (from Task spawns), then sessionId → type via session meta.
  const typeByAgentId = new Map<string, string>();
  for (const spawn of insights.taskSpawns) {
    if (spawn.agentIdFromResult && spawn.subagentType) {
      typeByAgentId.set(spawn.agentIdFromResult, spawn.subagentType);
    }
  }
  const agentIdToSession = new Map<string, string>();
  const typeBySession = new Map<string, string>();
  for (const [sid, meta] of insights.sessionsMeta) {
    if (meta.agentId) {
      agentIdToSession.set(meta.agentId, sid);
      if (typeByAgentId.has(meta.agentId)) typeBySession.set(sid, typeByAgentId.get(meta.agentId)!);
    }
  }
  const subagentTypeOf = (sessionId: string): string => typeBySession.get(sessionId) ?? 'unknown';

  // Session graph: a Task spawn ties a child (subagent) session to its parent, so a
  // sidechain session resolves up to the top-level session that ultimately launched it.
  const parentOf = new Map<string, string>();
  for (const spawn of insights.taskSpawns) {
    const childSid = spawn.agentIdFromResult ? agentIdToSession.get(spawn.agentIdFromResult) : undefined;
    if (childSid && spawn.sessionId && childSid !== spawn.sessionId) parentOf.set(childSid, spawn.sessionId);
  }
  const topLevelOf = (sessionId: string): string => {
    let cur = sessionId;
    const guard = new Set<string>();
    while (parentOf.has(cur) && !guard.has(cur)) {
      guard.add(cur);
      cur = parentOf.get(cur)!;
    }
    return cur;
  };

  // A top-level session is "subagent-heavy" if it spawned any subagent — either it
  // is a parent in the graph, or its session meta records subagent spawns.
  const heavyTop = new Set<string>();
  for (const parentSid of parentOf.values()) heavyTop.add(topLevelOf(parentSid));
  for (const [sid, meta] of insights.sessionsMeta) {
    if (meta.subagentSpawns > 0) heavyTop.add(topLevelOf(sid));
  }
  const isHeavyTop = (topLevelId: string): boolean => heavyTop.has(topLevelId);

  const buildFor = (windowMs: number): ContribWindow => {
    const from = now - windowMs;
    const windowEvents = events.filter((e) => e.ts >= from && e.ts <= now);
    return buildWindow(windowEvents, topLevelOf, isHeavyTop, subagentTypeOf);
  };

  return { day: buildFor(DAY_MS), week: buildFor(WEEK_MS) };
}
