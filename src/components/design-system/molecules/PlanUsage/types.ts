import type { ActiveBlock, WeeklyData, LiveUsageData } from '@/types';
import type { WeekStart } from '@/lib/week';

export interface PlanUsageProps {
  block: ActiveBlock | null;
  weekly: WeeklyData | null;
  liveUsage?: LiveUsageData | null;
  /** First day of the week — drives the weekly-reset countdown fallback. */
  weekStart: WeekStart;
  /** Plan / rate-limit tier label (e.g. "max_20x") shown as the source of these ceilings. */
  tier?: string | null;
}
