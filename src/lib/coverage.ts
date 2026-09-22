import type { WeeklyData } from '@/types';

const DAY = 86_400_000;

/**
 * Days of the selected window that history actually covers — the divisor for
 * per-day averages. When the previous period is empty, the data starts inside the
 * window (a new install, or Claude Code's ~30-day transcript cleanup), so the span
 * runs from the first day with usage to now. Dividing by the full window instead
 * would put a 1-year average over 4 months of logs at a third of the real rate.
 * With history before the window, the window length stands (quiet days count).
 */
export function coverageDays(weekly: WeeklyData | null | undefined, weekDays: number, now = Date.now()): number {
  if (!weekly || weekly.prevTotals.effectiveTokens > 0 || weekly.prevTotals.cost > 0) return weekDays;
  const first = weekly.buckets.find((b) => b.effectiveTokens > 0 || b.cost > 0);
  if (!first) return weekDays;
  return Math.max(1, Math.min(weekDays, Math.ceil((now - first.start) / DAY)));
}
