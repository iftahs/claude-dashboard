import { useLiveData } from './useLiveData';
import type { LiveSubagents } from '../types';

export interface LiveMetrics {
  /** Running subagents + main sessions actively working or delegating (Claude + Codex). */
  runningAgentCount: number;
  liveWorkflowCount: number;
  /** Current 5-hour limit utilization (0–100), or null when unavailable. */
  fiveHourPct: number | null;
  /** Codex (ChatGPT desktop) weekly limit utilization (0–100), or null when unavailable. */
  codexWeeklyPct: number | null;
  /** Auto-resume armed (once/always)? */
  autoResumeArmed: boolean;
  /** Sessions currently waiting for (or running) a scheduled resume. */
  autoResumeWaiting: number;
  /** Armed but nothing can execute the resumes (no watcher, no host CLI). */
  autoResumeExecutorMissing: boolean;
}

/** Running subagents + main sessions actively working or delegating, for one surface. */
function activeAgents(d: LiveSubagents | null): number {
  if (!d) return 0;
  return d.running.length + d.mainAgents.filter((m) => m.active || m.delegating).length;
}

/**
 * Live counters derived from the shared live polls — drives the sidebar badges
 * (visible from any tab) and the Agents header chips. Codex agents are summed
 * into the agent count; the Codex polls are disabled unless Codex data exists,
 * so Claude-only users get the Claude-only numbers.
 */
export function useLiveMetrics(): LiveMetrics {
  const { liveSubagents, codexAgents, codexLive, workflows, liveUsage, autoResume } = useLiveData();

  const runningAgentCount = activeAgents(liveSubagents.data) + activeAgents(codexAgents.data);
  const liveWorkflowCount = workflows.data?.live.length ?? 0;
  const fiveHourPct =
    liveUsage.data && !liveUsage.data.error && liveUsage.data.five_hour?.resets_at != null
      ? Math.round(liveUsage.data.five_hour.utilization)
      : null;
  const codexWeekly = codexLive.data && !codexLive.data.error ? codexLive.data.weekly : null;
  const codexWeeklyPct = codexWeekly ? Math.round(codexWeekly.usedPct) : null;

  const ar = autoResume.data;
  const autoResumeArmed = ar?.armed ?? false;
  const autoResumeWaiting = ar?.jobs.length ?? 0;
  const autoResumeExecutorMissing = autoResumeArmed && !!ar && !ar.watcher.online && !ar.internalExecutor;

  return {
    runningAgentCount,
    liveWorkflowCount,
    fiveHourPct,
    codexWeeklyPct,
    autoResumeArmed,
    autoResumeWaiting,
    autoResumeExecutorMissing,
  };
}
