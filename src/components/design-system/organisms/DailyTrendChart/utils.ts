import { dayLabel } from '@/lib/format';
import type { WeeklyData } from '@/types';
import type { DailyMetric } from './types';

/** Percent change vs the previous period for the selected metric (null if no prev). */
export function trendDelta(data: WeeklyData | null, metric: DailyMetric): number | null {
  if (!data) return null;
  const currentVal = metric === 'cost' ? data.totals.cost : data.totals.effectiveTokens;
  const prevVal = metric === 'cost' ? data.prevTotals.cost : data.prevTotals.effectiveTokens;
  return prevVal > 0 ? Math.round(((currentVal - prevVal) / prevVal) * 100) : null;
}

/** Per-day CSV/JSON payload for the export button. */
export function trendExport(data: WeeklyData, weekDays: number) {
  const csv = data.buckets.map((b) => ({
    date: dayLabel(b.start),
    effectiveTokens: b.effectiveTokens,
    cost: b.cost.toFixed(4),
    ...b.byModel,
  }));
  return { csv, json: data.buckets, filename: `trends-${weekDays}d` };
}
