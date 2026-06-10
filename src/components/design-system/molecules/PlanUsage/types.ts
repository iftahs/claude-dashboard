import type { ActiveBlock, WeeklyData, LiveUsageData } from '@/types';

export interface PlanUsageProps {
  block: ActiveBlock | null;
  weekly: WeeklyData | null;
  liveUsage?: LiveUsageData | null;
}
