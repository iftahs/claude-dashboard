import type { WeekStart } from '@/lib/week';

// Labels indexed by the backend grid's day index (0=Mon … 6=Sun).
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Backend row indices (0=Mon..6=Sun) in display order for the chosen week start. */
export function dayOrder(weekStart: WeekStart): number[] {
  const monFirst = [0, 1, 2, 3, 4, 5, 6];
  return weekStart === 'sunday' ? [6, ...monFirst.slice(0, 6)] : monFirst;
}

export function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}
