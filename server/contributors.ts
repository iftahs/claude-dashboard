// "What's contributing to your limits usage?" — a local, cost-weighted replica of
// the breakdown the Claude Code CLI shows under its usage view. Every figure is a
// *share of estimated cost* (dollars, via pricing.ts), not a token or call count,
// matching the CLI: `pct = round(behaviour.cost / totalCost * 100)`, shown only when
// pct >= SHOW_PCT. Two independent windows (Day = last 24h, Week = last 7d).
//
// Attribution comes from the CLI's OWN per-request tags — `attributionAgent`,
// `attributionSkill`, `attributionMcpServer`, `attributionPlugin` — which Claude Code
// writes onto every assistant message and its usage view reads back. Using them
// (rather than reconstructing from tool names / session graphs) is what makes the
// subagent, skill and MCP breakdowns match Claude exactly, including the CLI's rule
// that an MCP server's cost covers the whole session tail once its results are in
// context. Context (>150k), 8h-session and 4+-parallel thresholds are the CLI's.

import type { UsageEvent } from './scan.ts';
import { estimateCost } from './pricing.ts';

const DAY_MS = 24 * 3600_000;
const WEEK_MS = 7 * DAY_MS;

const SHOW_PCT = 10; // CLI: hlr / A4o — an insight surfaces only at >=10% of cost
const CTX_THRESHOLD = 150_000; // CLI: b8f — ">150k context"
const PARALLEL_MIN = 4; // CLI: m5l — "4+ sessions ran in parallel"
const CRON_MS = 8 * 3600_000; // CLI: sessions "active for 8+ hours"
const TOP_N = 8; // rows kept per breakdown table
const MAX_INSIGHTS = 6; // headline lines kept (behaviours + entities), like the CLI

export interface ContribBehavior {
  key: string;
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

const MCP_BODY =
  'MCP tool results stay in context for the rest of the session. /compact to flush them, or disable servers you don’t need.';

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

/** Active top-level-session count at any ts (sweep line over session intervals). */
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

function buildWindow(events: UsageEvent[]): ContribWindow {
  // Per-session first/last ts + whether it is a top-level (non-subagent) session.
  // Subagent sub-sessions are excluded from the "parallel" / "8h" behaviours: a
  // workflow fanning out 16 agents isn't "16 sessions in parallel", and a subagent's
  // own transcript is short-lived. Top-level = has at least one non-sidechain message.
  const sess = new Map<string, { first: number; last: number; topLevel: boolean }>();
  for (const e of events) {
    if (!e.sessionId) continue;
    const s = sess.get(e.sessionId);
    if (s) {
      if (e.ts < s.first) s.first = e.ts;
      if (e.ts > s.last) s.last = e.ts;
      if (!e.isSidechain) s.topLevel = true;
    } else sess.set(e.sessionId, { first: e.ts, last: e.ts, topLevel: !e.isSidechain });
  }
  const activeAt = makeConcurrency(
    [...sess.values()].filter((s) => s.topLevel).map((s) => [s.first, s.last]),
  );

  // A top-level session is "subagent-heavy" if anything under it (orchestrator or a
  // spawned subagent, rolled up by rootSessionId) ran as a subagent. The CLI counts
  // the whole session-group's cost for this behaviour, not just the subagent requests.
  const heavyRoot = new Set<string>();
  for (const e of events) if (e.attributionAgent) heavyRoot.add(e.rootSessionId);

  let totalCost = 0;
  let longCtx = 0;
  let subagentHeavy = 0;
  let highParallel = 0;
  let cron = 0;

  const byMcp = new Map<string, number>();
  const bySubagent = new Map<string, number>();
  const bySkill = new Map<string, number>();
  const byPlugin = new Map<string, number>();

  for (const e of events) {
    const cost = estimateCost(e.model, e);
    if (cost <= 0) continue;
    totalCost += cost;

    // Behaviours (independent characteristics — shares can overlap).
    const contextTokens = e.inputTokens + e.cacheReadTokens + e.cacheCreateTokens;
    if (contextTokens > CTX_THRESHOLD) longCtx += cost;
    if (heavyRoot.has(e.rootSessionId)) subagentHeavy += cost;
    if (activeAt(e.ts) >= PARALLEL_MIN) highParallel += cost;
    const s = sess.get(e.sessionId);
    if (s && s.topLevel && s.last - s.first >= CRON_MS) cron += cost;

    // Breakdowns — straight from the CLI's attribution tags.
    addTo(byMcp, e.attributionMcpServer, cost);
    addTo(bySubagent, e.attributionAgent, cost);
    addTo(bySkill, e.attributionSkill, cost);
    addTo(byPlugin, e.attributionPlugin, cost);
  }

  const pct = (cost: number): number => (totalCost > 0 ? Math.round((cost / totalCost) * 100) : 0);

  // Headline insights: the four behaviours plus any single MCP server / skill /
  // plugin that alone exceeds the threshold (the CLI promotes these to headlines
  // too, e.g. `22% of your usage came from MCP server "chrome-devtools"`).
  const candidates: ContribBehavior[] = [
    { key: 'subagent_heavy', pct: pct(subagentHeavy), headline: `${pct(subagentHeavy)}% of your usage came from subagent-heavy sessions`, body: 'Each subagent runs its own requests. Be deliberate about spawning them — and consider configuring a cheaper model for simpler subagents.' },
    { key: 'long_context', pct: pct(longCtx), headline: `${pct(longCtx)}% of your usage was at >150k context`, body: 'Longer sessions are more expensive even when cached. /compact mid-task, /clear when switching to new tasks.' },
    { key: 'high_parallel', pct: pct(highParallel), headline: `${pct(highParallel)}% of your usage was while 4+ sessions ran in parallel`, body: "All sessions share one limit. If you don't need them all at once, queueing uses it more evenly." },
    { key: 'cron', pct: pct(cron), headline: `${pct(cron)}% of your usage came from sessions active for 8+ hours`, body: 'These are often background/loop sessions. Continuous usage can add up quickly so make sure it is intentional.' },
  ];
  const topMcp = toRows(byMcp, totalCost)[0];
  if (topMcp && topMcp.pct >= SHOW_PCT) {
    candidates.push({ key: `mcp:${topMcp.name}`, pct: topMcp.pct, headline: `${topMcp.pct}% of your usage came from MCP server "${topMcp.name}"`, body: MCP_BODY });
  }
  const topSkill = toRows(bySkill, totalCost)[0];
  if (topSkill && topSkill.pct >= SHOW_PCT) {
    candidates.push({ key: `skill:${topSkill.name}`, pct: topSkill.pct, headline: `${topSkill.pct}% of your usage came from /${topSkill.name}`, body: "This skill's instructions stay in context for the rest of the session." });
  }
  const topPlugin = toRows(byPlugin, totalCost)[0];
  if (topPlugin && topPlugin.pct >= SHOW_PCT) {
    candidates.push({ key: `plugin:${topPlugin.name}`, pct: topPlugin.pct, headline: `${topPlugin.pct}% of your usage came from plugin "${topPlugin.name}"`, body: 'Plugin skills and commands add to every request while active.' });
  }

  const behaviors = candidates
    .filter((b) => b.pct >= SHOW_PCT)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, MAX_INSIGHTS);

  return {
    totalCost,
    requestCount: events.length,
    sessionCount: [...sess.values()].filter((s) => s.topLevel).length,
    behaviors,
    subagents: toRows(bySubagent, totalCost),
    mcpServers: toRows(byMcp, totalCost),
    skills: toRows(bySkill, totalCost),
    plugins: toRows(byPlugin, totalCost),
  };
}

export function buildContributors(events: UsageEvent[], now: number): ContributorsData {
  const windowOf = (windowMs: number): ContribWindow => {
    const from = now - windowMs;
    return buildWindow(events.filter((e) => e.ts >= from && e.ts <= now));
  };
  return { day: windowOf(DAY_MS), week: windowOf(WEEK_MS) };
}
