import { useLiveData } from './useLiveData';

export interface LiveMetrics {
  /** Running subagents + main sessions actively working or delegating. */
  runningAgentCount: number;
  liveWorkflowCount: number;
  /** Current 5-hour limit utilization (0–100), or null when unavailable. */
  fiveHourPct: number | null;
}

/**
 * Live counters derived from the shared live polls — drives the sidebar badges
 * (visible from any tab) and the Agents header chips.
 */
export function useLiveMetrics(): LiveMetrics {
  const { liveSubagents, workflows, liveUsage } = useLiveData();

  const runningAgentCount =
    (liveSubagents.data?.running.length ?? 0) +
    (liveSubagents.data?.mainAgents.filter((m) => m.active || m.delegating).length ?? 0);
  const liveWorkflowCount = workflows.data?.live.length ?? 0;
  const fiveHourPct =
    liveUsage.data && !liveUsage.data.error && liveUsage.data.five_hour?.resets_at != null
      ? Math.round(liveUsage.data.five_hour.utilization)
      : null;

  return { runningAgentCount, liveWorkflowCount, fiveHourPct };
}
