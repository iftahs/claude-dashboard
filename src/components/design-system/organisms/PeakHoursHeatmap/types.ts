import type { WeekStart } from '@/lib/week';

export interface PeakHoursHeatmapProps {
  grid: number[][];
  /** First day of the week — sets the row order. */
  weekStart: WeekStart;
}
