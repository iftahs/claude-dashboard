import type { WeeklyData } from '@/types';

export function blockBarColor(pct: number): string {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#d97757';
}

/**
 * Effective tokens over the last `n` daily buckets. The weekly poll follows the
 * Trends window (up to a year), but the weekly limit is a 7-day window — summing
 * the whole payload would pin the offline bar at 100% on long windows.
 */
export function lastDaysEffective(weekly: WeeklyData | null | undefined, n: number): number {
  return (weekly?.buckets ?? []).slice(-n).reduce((sum, b) => sum + b.effectiveTokens, 0);
}
