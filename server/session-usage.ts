import { eventWeight, weightOf } from './contributors.ts';
import { estimateCost } from './pricing.ts';
import { projectNameOf } from './project-path.ts';
import type { UsageEvent, UsageSource } from './scan.ts';
import type { InsightsData } from './insights-scan.ts';
import { sessionTitle } from './sessions.ts';

export interface SessionUsageModel {
  model: string;
  cost: number;
  /** Share of the session's cost, 0..1 (0 when nothing is priced). */
  share: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Part of cacheWriteTokens written with the 1-hour TTL. */
  cacheWrite1hTokens: number;
}

export interface SessionContributor {
  kind: 'subagent' | 'skill' | 'mcp' | 'plugin';
  name: string;
  /** Share of the session's cost (Codex: effective tokens), 0..1. */
  share: number;
}

export interface SessionUsageData {
  sessionId: string;
  source: UsageSource;
  title: string | null;
  /** Last path segment of the project — never the full path. */
  projectName: string;
  firstTs: number;
  lastTs: number;
  totalCost: number;
  /** Sum of recorded turn durations; null when no turn was recorded. */
  activeMs: number | null;
  linesAdded: number;
  linesRemoved: number;
  webSearches: number;
  /** cache reads / (input + cache reads + cache writes), 0..1. */
  cacheHitRate: number;
  /** The main transcript was over the size cap: active time, lines and counts are incomplete (cost and tokens are not). */
  partial: boolean;
  models: SessionUsageModel[];
  contributors: SessionContributor[];
}

const PER_KIND = 8;

const TAGS: Array<[SessionContributor['kind'], keyof Pick<UsageEvent, 'attributionAgent' | 'attributionSkill' | 'attributionMcpServer' | 'attributionPlugin'>]> = [
  ['subagent', 'attributionAgent'],
  ['skill', 'attributionSkill'],
  ['mcp', 'attributionMcpServer'],
  ['plugin', 'attributionPlugin'],
];

/** One session's cost and token breakdown, or null when the id is unknown. Subagent requests fold in through rootSessionId. */
export function buildSessionUsage(
  sessionId: string,
  events: UsageEvent[],
  insights: InsightsData,
  codexTitles: Map<string, string>,
): SessionUsageData | null {
  const sm = insights.sessionsMeta.get(sessionId);
  if (!sm) return null;
  const mine = events.filter((e) => (e.rootSessionId || e.sessionId) === sessionId);

  const byModel = new Map<string, SessionUsageModel>();
  let webSearches = 0;
  let input = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  for (const e of mine) {
    webSearches += e.webSearchRequests ?? 0;
    input += e.inputTokens;
    cacheRead += e.cacheReadTokens;
    cacheWrite += e.cacheCreateTokens;
    if (e.model === '<synthetic>') continue;
    let m = byModel.get(e.model);
    if (!m) {
      m = { model: e.model, cost: 0, share: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0 };
      byModel.set(e.model, m);
    }
    m.cost += estimateCost(e.model, e);
    m.inputTokens += e.inputTokens;
    m.outputTokens += e.outputTokens;
    m.cacheReadTokens += e.cacheReadTokens;
    m.cacheWriteTokens += e.cacheCreateTokens;
    m.cacheWrite1hTokens += e.cacheWrite1hTokens ?? 0;
  }
  const models = [...byModel.values()].filter(
    (m) => m.inputTokens + m.outputTokens + m.cacheReadTokens + m.cacheWriteTokens > 0,
  );
  const totalCost = models.reduce((sum, m) => sum + m.cost, 0);
  for (const m of models) m.share = totalCost > 0 ? m.cost / totalCost : 0;
  models.sort((a, b) => b.cost - a.cost);

  const weightBy = weightOf(mine);
  const weights = new Map(TAGS.map(([kind]) => [kind, new Map<string, number>()]));
  let totalWeight = 0;
  for (const e of mine) {
    const weight = eventWeight(e, weightBy);
    if (weight <= 0) continue;
    totalWeight += weight;
    for (const [kind, field] of TAGS) {
      const name = e[field];
      if (!name) continue;
      const byName = weights.get(kind)!;
      byName.set(name, (byName.get(name) ?? 0) + weight);
    }
  }
  const contributors: SessionContributor[] = [];
  if (totalWeight > 0) {
    for (const [kind, byName] of weights) {
      const top = [...byName]
        .map(([name, weight]): SessionContributor => ({ kind, name, share: weight / totalWeight }))
        .sort((a, b) => b.share - a.share)
        .slice(0, PER_KIND);
      contributors.push(...top);
    }
    contributors.sort((a, b) => b.share - a.share);
  }

  const cacheTotal = input + cacheRead + cacheWrite;
  return {
    sessionId,
    source: sm.source,
    title: sessionTitle(sm, codexTitles) ?? null,
    projectName: sm.projectPath ? projectNameOf(sm.projectPath) : '',
    firstTs: sm.firstTs,
    lastTs: sm.lastTs,
    totalCost,
    activeMs: insights.turns.some((t) => t.sessionId === sessionId) ? sm.activeMs : null,
    linesAdded: sm.linesAdded,
    linesRemoved: sm.linesRemoved,
    webSearches,
    cacheHitRate: cacheTotal > 0 ? cacheRead / cacheTotal : 0,
    partial: sm.partial === true,
    models,
    contributors,
  };
}
