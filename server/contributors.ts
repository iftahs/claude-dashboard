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
//
// Codex gets the same panel with two differences. Its shares are of EFFECTIVE
// TOKENS, not cost: the Guardian auto-review model is priced at $0, so a
// cost-weighted breakdown would make every auto-review invisible even though it
// spends the plan's limit. And the copy talks about threads and auto-reviews, not
// Claude Code's sessions, subagents and slash commands.

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
  /** What every pct is a share of: estimated cost (Claude), or effective tokens (Codex). */
  weight: 'cost' | 'effectiveTokens';
}

type Platform = 'claude' | 'codex';
type BehaviourKey = 'subagent_heavy' | 'long_context' | 'high_parallel' | 'cron';

/** Codex-only input gets Codex weighting and copy; anything with Claude usage keeps the CLI's. */
function platformOf(events: UsageEvent[]): Platform {
  return events.length > 0 && events.every((e) => e.source === 'codex') ? 'codex' : 'claude';
}

/** Per-platform wording of the headline behaviours. */
const COPY: Record<Platform, Record<BehaviourKey, { headline: (p: number) => string; body: string }>> = {
  claude: {
    subagent_heavy: { headline: (p) => `${p}% of your usage came from subagent-heavy sessions`, body: 'Each subagent runs its own requests. Be deliberate about spawning them — and consider configuring a cheaper model for simpler subagents.' },
    long_context: { headline: (p) => `${p}% of your usage was at >150k context`, body: 'Longer sessions are more expensive even when cached. /compact mid-task, /clear when switching to new tasks.' },
    high_parallel: { headline: (p) => `${p}% of your usage was while 4+ sessions ran in parallel`, body: "All sessions share one limit. If you don't need them all at once, queueing uses it more evenly." },
    cron: { headline: (p) => `${p}% of your usage came from sessions active for 8+ hours`, body: 'These are often background/loop sessions. Continuous usage can add up quickly so make sure it is intentional.' },
  },
  codex: {
    subagent_heavy: { headline: (p) => `${p}% of your usage came from threads with Guardian auto-reviews`, body: 'Each auto-review runs its own model requests on top of the turn it checks, and they count against the same plan limit.' },
    long_context: { headline: (p) => `${p}% of your usage was at >150k context`, body: 'Long threads cost more with every turn, even when cached. Start a new thread when you switch to a new task.' },
    high_parallel: { headline: (p) => `${p}% of your usage was while 4+ threads ran in parallel`, body: "All threads share one plan limit. If you don't need them all at once, queueing uses it more evenly." },
    cron: { headline: (p) => `${p}% of your usage came from threads active for 8+ hours`, body: 'Long-running threads keep spending for as long as they work. Continuous usage can add up quickly so make sure it is intentional.' },
  },
};

const MCP_BODY: Record<Platform, string> = {
  claude: 'MCP tool results stay in context for the rest of the session. /compact to flush them, or disable servers you don’t need.',
  codex: 'MCP tool results stay in the thread’s context. Start a new thread to drop them, or disable servers you don’t need.',
};

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

function buildWindow(events: UsageEvent[], platform: Platform): ContribWindow {
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

  let totalWeight = 0;
  for (const e of events) {
    const cost = estimateCost(e.model, e);
    const weight = platform === 'codex' ? e.inputTokens + e.outputTokens + e.cacheCreateTokens : cost;
    if (weight <= 0) continue;
    totalCost += cost;
    totalWeight += weight;

    // Behaviours (independent characteristics — shares can overlap).
    const contextTokens = e.inputTokens + e.cacheReadTokens + e.cacheCreateTokens;
    if (contextTokens > CTX_THRESHOLD) longCtx += weight;
    if (heavyRoot.has(e.rootSessionId)) subagentHeavy += weight;
    if (activeAt(e.ts) >= PARALLEL_MIN) highParallel += weight;
    const s = sess.get(e.sessionId);
    if (s && s.topLevel && s.last - s.first >= CRON_MS) cron += weight;

    // Breakdowns — straight from the CLI's attribution tags.
    addTo(byMcp, e.attributionMcpServer, weight);
    addTo(bySubagent, e.attributionAgent, weight);
    addTo(bySkill, e.attributionSkill, weight);
    addTo(byPlugin, e.attributionPlugin, weight);
  }

  const pct = (w: number): number => (totalWeight > 0 ? Math.round((w / totalWeight) * 100) : 0);
  const behaviour = (key: BehaviourKey, share: number): ContribBehavior => ({
    key, pct: pct(share), headline: COPY[platform][key].headline(pct(share)), body: COPY[platform][key].body,
  });

  // Headline insights: the four behaviours plus any single MCP server / skill /
  // plugin that alone exceeds the threshold (the CLI promotes these to headlines
  // too, e.g. `22% of your usage came from MCP server "chrome-devtools"`).
  const candidates: ContribBehavior[] = [
    behaviour('subagent_heavy', subagentHeavy),
    behaviour('long_context', longCtx),
    behaviour('high_parallel', highParallel),
    behaviour('cron', cron),
  ];
  const topMcp = toRows(byMcp, totalWeight)[0];
  if (topMcp && topMcp.pct >= SHOW_PCT) {
    candidates.push({ key: `mcp:${topMcp.name}`, pct: topMcp.pct, headline: `${topMcp.pct}% of your usage came from MCP server "${topMcp.name}"`, body: MCP_BODY[platform] });
  }
  const topSkill = toRows(bySkill, totalWeight)[0];
  if (topSkill && topSkill.pct >= SHOW_PCT) {
    candidates.push({ key: `skill:${topSkill.name}`, pct: topSkill.pct, headline: `${topSkill.pct}% of your usage came from /${topSkill.name}`, body: "This skill's instructions stay in context for the rest of the session." });
  }
  const topPlugin = toRows(byPlugin, totalWeight)[0];
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
    subagents: toRows(bySubagent, totalWeight),
    mcpServers: toRows(byMcp, totalWeight),
    skills: toRows(bySkill, totalWeight),
    plugins: toRows(byPlugin, totalWeight),
  };
}

export function buildContributors(events: UsageEvent[], now: number): ContributorsData {
  const platform = platformOf(events);
  const windowOf = (windowMs: number): ContribWindow => {
    const from = now - windowMs;
    return buildWindow(events.filter((e) => e.ts >= from && e.ts <= now), platform);
  };
  return { day: windowOf(DAY_MS), week: windowOf(WEEK_MS), weight: platform === 'codex' ? 'effectiveTokens' : 'cost' };
}
