import type { WeeklyData } from '@/types';

const DAY = 86_400_000;

/**
 * Days of the selected window that history actually covers — the divisor for
 * per-day averages. When the earliest logged event falls inside the window (a new
 * install, or Claude Code's ~30-day transcript cleanup), the span runs from that
 * event to now; dividing by the full window would put a 1-year average over 4
 * months of logs at a third of the real rate. Quiet days after the first event
 * still count, so a vacation does not inflate the average.
 */
export function coverageDays(weekly: WeeklyData | null | undefined, weekDays: number, now = Date.now()): number {
  if (!weekly || weekly.firstEventTs == null) return weekDays;
  const start = Math.max(weekly.rangeFrom, weekly.firstEventTs);
  return Math.max(1, Math.min(weekDays, Math.ceil((now - start) / DAY)));
}
