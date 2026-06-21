import type { WorkflowAgentInfo, WorkflowRun } from '@/types';
import { compact } from '@/lib/format';
import { formatElapsed } from '@/components/design-system/organisms/AgentActivity/utils';

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
