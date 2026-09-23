import type { PollState } from '@/hooks/usePolling';
import type { CodexLiveData } from '@/types';
import type { WeekStart } from '@/lib/week';

/** One StatCard's worth of Codex data (the server-side profile stats — see utils `profileStats`). */
export interface CodexStat {
  key: string;
  label: string;
  value: string;
  sub?: string;
  help?: string;
  /** Value colour override (e.g. red when the plan limit is reached). */
  accent?: string;
}

/** The Codex rate-limit card — the Codex counterpart of the Claude PlanUsage card. */
export interface CodexPlanCardProps {
  live: PollState<CodexLiveData>;
  /** First day of the week — drives PlanUsage's weekly-reset countdown fallback. */
  weekStart: WeekStart;
}
