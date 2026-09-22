import type { PollState } from '@/hooks/usePolling';
import type { CodexLiveData, CodexProfileStats } from '@/types';
import type { WeekStart } from '@/lib/week';

/** One StatCard's worth of Codex data, built by the utils and rendered by the panel. */
export interface CodexStat {
  key: string;
  label: string;
  value: string;
  sub?: string;
  help?: string;
  /** Value colour override (e.g. red when the plan limit is reached). */
  accent?: string;
}

/** The rate-limit card on its own — the Codex counterpart of BlockGauge/PlanUsage. */
export interface CodexPlanCardProps {
  live: PollState<CodexLiveData>;
  /** First day of the week — drives PlanUsage's weekly-reset countdown fallback. */
  weekStart: WeekStart;
}

export interface CodexPlanStatsProps {
  live: PollState<CodexLiveData>;
  profile: PollState<CodexProfileStats>;
  /** Compact (side-by-side) mode: one 2x2 of the four most useful cards. */
  compact?: boolean;
}

export interface CodexPlanPanelProps extends CodexPlanCardProps, CodexPlanStatsProps {}
