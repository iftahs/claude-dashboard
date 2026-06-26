import type { WorkflowAgentInfo, WorkflowRun } from '@/types';
import { compact } from '@/lib/format';
import { formatElapsed } from '@/components/design-system/organisms/AgentActivity/utils';

/** A relative-date bucket of recent runs, newest-first. */
export interface DateBucket {
  label: string;
  runs: WorkflowRun[];
}

/**
 * Bucket finished runs by `startedAt` into relative date groups:
 * Today / Yesterday / Earlier this week / Earlier this month / "<Month YYYY>".
 * Fixed labels come first in that order; older month buckets follow newest-first.
 * Empty buckets are dropped. Week starts Monday (local time).
 */
export function groupRunsByDate(runs: WorkflowRun[]): DateBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startToday = today.getTime();
  const startYesterday = startToday - 86_400_000;
  const mondayOffset = (today.getDay() + 6) % 7; // 0 = Monday
  const startWeek = startToday - mondayOffset * 86_400_000;
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();

  const labelOf = (ts: number): string => {
    if (ts >= startToday) return 'Today';
    if (ts >= startYesterday) return 'Yesterday';
    if (ts >= startWeek) return 'Earlier this week';
    if (ts >= startMonth) return 'Earlier this month';
    return new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const byLabel = new Map<string, WorkflowRun[]>();
  for (const r of [...runs].sort((a, b) => b.startedAt - a.startedAt)) {
    const label = labelOf(r.startedAt);
    const arr = byLabel.get(label);
    if (arr) arr.push(r);
    else byLabel.set(label, [r]);
  }

  const buckets: DateBucket[] = [];
  for (const l of ['Today', 'Yesterday', 'Earlier this week', 'Earlier this month']) {
    const arr = byLabel.get(l);
    if (arr) {
      buckets.push({ label: l, runs: arr });
      byLabel.delete(l);
    }
  }
  for (const [label, arr] of byLabel) buckets.push({ label, runs: arr }); // month labels, newest-first
  return buckets;
}

/** One phase plus the agents the backend has actually seen for it. */
export interface PhaseGroup {
  title: string;
  detail: string;
  agents: WorkflowAgentInfo[];
  done: number; // agents in this phase with state === 'done'
  total: number; // KNOWN agents in this phase (backend can't see planned-but-unstarted)
}

/**
 * Group `run.agents` by `agent.phaseTitle`, ordered by `run.phases`.
 * Phases from `run.phases` come first (even with zero known agents → "not started");
 * any `phaseTitle` seen on an agent but absent from `run.phases` is appended in
 * first-seen order. Agents with an empty `phaseTitle` bucket under 'Ungrouped'.
 */
export function buildPhaseGroups(run: WorkflowRun): PhaseGroup[] {
  const byTitle = new Map<string, WorkflowAgentInfo[]>();
  for (const a of run.agents) {
    const key = a.phaseTitle || '';
    const arr = byTitle.get(key);
    if (arr) arr.push(a);
    else byTitle.set(key, [a]);
  }

  const groups: PhaseGroup[] = [];
  const used = new Set<string>();

  const push = (key: string, title: string, detail: string) => {
    const agents = byTitle.get(key) ?? [];
    groups.push({
      title,
      detail,
      agents,
      done: agents.filter((a) => a.state === 'done').length,
      total: agents.length,
    });
  };

  // 1) Ordered phases from run.phases (may have 0 known agents).
  for (const p of run.phases) {
    used.add(p.title);
    push(p.title, p.title, p.detail);
  }

  // 2) Phase titles seen on agents but absent from run.phases.
  for (const a of run.agents) {
    const key = a.phaseTitle || '';
    if (used.has(key)) continue;
    used.add(key);
    push(key, key || 'Ungrouped', '');
  }

  return groups;
}

/**
 * Default selected phase index:
 *  - first phase containing a 'running' agent, else
 *  - last phase that has any agent, else
 *  - 0.
 */
export function defaultActivePhaseIndex(groups: PhaseGroup[]): number {
  const running = groups.findIndex((g) => g.agents.some((a) => a.state === 'running'));
  if (running !== -1) return running;
  let lastWithAgents = -1;
  for (let i = 0; i < groups.length; i++) if (groups[i].total > 0) lastWithAgents = i;
  return lastWithAgents === -1 ? 0 : lastWithAgents;
}

/** Header progress numerator: agents the backend has marked done. */
export function doneAgentCount(run: WorkflowRun): number {
  return run.agents.filter((a) => a.state === 'done').length;
}

/**
 * Per-agent metric tail: "28.6K tok · 1 tool · 20s". Omits the tool count when 0.
 * Elapsed uses `durationMs`; pass `elapsedSecOverride` to inject a value (and pass
 * 0 to drop the static elapsed segment, e.g. when a live ticker renders it instead).
 */
export function agentMetrics(agent: WorkflowAgentInfo, elapsedSecOverride?: number): string {
  const parts: string[] = [];
  if (agent.tokens > 0) parts.push(`${compact(agent.tokens)} tok`);
  if (agent.toolCalls > 0) parts.push(`${agent.toolCalls} tool${agent.toolCalls === 1 ? '' : 's'}`);
  const sec = elapsedSecOverride ?? Math.floor(agent.durationMs / 1000);
  if (sec > 0) parts.push(formatElapsed(sec));
  return parts.join(' · ');
}
