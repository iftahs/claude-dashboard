import type { DailyActivity } from '@/types';
import type { WeekStart } from '@/lib/week';

export interface ActivityHeatmapProps {
  days: DailyActivity[];
  /** First day of the week — sets the row order and column alignment. */
  weekStart: WeekStart;
}
