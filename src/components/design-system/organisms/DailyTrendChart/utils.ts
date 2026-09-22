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

/** Per-day CSV/JSON payload for the export button. Every row carries every model
 *  column (0 when idle) — CSV headers come from the first row, which on a long
 *  window is often an empty day. */
export function trendExport(data: WeeklyData, weekDays: number) {
  const models = [...new Set(data.buckets.flatMap((b) => Object.keys(b.byModel)))];
  const csv = data.buckets.map((b) => ({
    date: dayLabel(b.start),
    effectiveTokens: b.effectiveTokens,
    cost: b.cost.toFixed(4),
    ...Object.fromEntries(models.map((m) => [m, b.byModel[m] ?? 0])),
  }));
  return { csv, json: data.buckets, filename: `trends-${weekDays}d` };
}
