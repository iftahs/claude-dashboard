import { useLiveData } from './useLiveData';
import { useSource } from './useSource';
import type { LiveSubagents } from '../types';

export interface LiveMetrics {
  /** Running subagents + main sessions actively working or delegating, for the active platform. */
  runningAgentCount: number;
  liveWorkflowCount: number;
  /** Claude's current 5-hour limit utilization (0–100), or null when unavailable. */
  fiveHourPct: number | null;
  /** Codex (ChatGPT desktop) weekly limit utilization (0–100), or null when unavailable. */
  codexWeeklyPct: number | null;
  /** The utilization the header/sidebar/tab title should show for the active platform. */
  limitPct: number | null;
  /** What `limitPct` measures, for the badge tooltip ("5-hour limit" / "Codex weekly limit"). */
  limitTitle: string;
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
 * (visible from any tab) and the Agents header chips. Everything is scoped to the
 * platform switcher: Claude only under 'claude', Codex only under 'codex', summed
 * under 'both'. The Codex polls are disabled unless Codex data exists, and the
 * platform is pinned to 'claude' in that case, so Claude-only users get exactly
 * the Claude numbers.
 *
 * `limitPct` is the one number the sidebar badge and the browser tab show: Claude's
 * 5-hour window under 'claude' and 'both' (the window the user is actually racing),
 * Codex's weekly window under 'codex' — Codex's 5-hour window is rarely the binding
 * constraint, and it is the weekly one people watch.
 */
export function useLiveMetrics(): LiveMetrics {
  const { showClaude, showCodex } = useSource();
  const { liveSubagents, codexAgents, codexLive, workflows, liveUsage, autoResume } = useLiveData();

  const runningAgentCount =
    (showClaude ? activeAgents(liveSubagents.data) : 0) + (showCodex ? activeAgents(codexAgents.data) : 0);
  const liveWorkflowCount = workflows.data?.live.length ?? 0;
  const fiveHourPct =
    liveUsage.data && !liveUsage.data.error && liveUsage.data.five_hour?.resets_at != null
      ? Math.round(liveUsage.data.five_hour.utilization)
      : null;
  const codexWeekly = codexLive.data && !codexLive.data.error ? codexLive.data.weekly : null;
  const codexWeeklyPct = codexWeekly ? Math.round(codexWeekly.usedPct) : null;

  const codexOnly = showCodex && !showClaude;
  const limitPct = codexOnly ? codexWeeklyPct : fiveHourPct;
  const limitTitle = codexOnly ? 'Codex weekly limit' : '5-hour limit';

  const ar = autoResume.data;
  const autoResumeArmed = ar?.armed ?? false;
  const autoResumeWaiting = ar?.jobs.length ?? 0;
  const autoResumeExecutorMissing = autoResumeArmed && !!ar && !ar.watcher.online && !ar.internalExecutor;

  return {
    runningAgentCount,
    liveWorkflowCount,
    fiveHourPct,
    codexWeeklyPct,
    limitPct,
    limitTitle,
    autoResumeArmed,
    autoResumeWaiting,
    autoResumeExecutorMissing,
  };
}
