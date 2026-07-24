import type { WeekStart } from '@/lib/week';

// Labels indexed by the backend grid's day index (0=Mon … 6=Sun).
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Same indexing as DAYS — spelled out for prose, where "Mon" reads as an abbreviation. */
export const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Backend row indices (0=Mon..6=Sun) in display order for the chosen week start. */
export function dayOrder(weekStart: WeekStart): number[] {
  const monFirst = [0, 1, 2, 3, 4, 5, 6];
  return weekStart === 'sunday' ? [6, ...monFirst.slice(0, 6)] : monFirst;
}

/**
 * The single busiest cell in the grid — null when there is no usage at all, so the
 * caller can omit the sentence rather than claim a peak of zero. Ties keep the first
 * (earliest day, then earliest hour), which is arbitrary but stable across renders.
 */
export function peakCell(grid: number[][]): { day: number; hour: number; value: number } | null {
  let best: { day: number; hour: number; value: number } | null = null;
  for (let day = 0; day < grid.length; day++) {
    for (let hour = 0; hour < grid[day].length; hour++) {
      const value = grid[day][hour];
      if (value > 0 && (best === null || value > best.value)) best = { day, hour, value };
    }
  }
  return best;
}

export function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}
