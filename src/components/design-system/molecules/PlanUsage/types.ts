import type { ActiveBlock, WeeklyData, LiveUsageData } from '@/types';
import type { WeekStart } from '@/lib/week';

export interface PlanUsageProps {
  block: ActiveBlock | null;
  weekly: WeeklyData | null;
  liveUsage?: LiveUsageData | null;
  /** First day of the week — drives the weekly-reset countdown fallback. */
  weekStart: WeekStart;
}
