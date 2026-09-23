import type { PollState } from '@/hooks/usePolling';
import type { CodexLiveData } from '@/types';
import type { WeekStart } from '@/lib/week';

export interface CodexStat {
  key: string;
  label: string;
  value: string;
  sub?: string;
  help?: string;
  /** Value colour override (e.g. red when the plan limit is reached). */
  accent?: string;
}

export interface CodexPlanCardProps {
  live: PollState<CodexLiveData>;
  /** First day of the week — drives PlanUsage's weekly-reset countdown fallback. */
  weekStart: WeekStart;
}
