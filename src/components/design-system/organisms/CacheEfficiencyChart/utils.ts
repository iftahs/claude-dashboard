import type { CacheCompareRow, CacheEfficiencyPoint, CacheSeries } from './types';

/** Mean of the daily hit rates (days without usage are absent, not zero). */
export function avgHitRate(points: CacheEfficiencyPoint[]): number {
  return points.length ? points.reduce((s, d) => s + d.hitRate, 0) / points.length : 0;
}

// A day a platform was idle stays `undefined`, so its line breaks there instead of dipping to a fake 0%.
export function mergeCacheSeries(series: CacheSeries[]): {
  rows: CacheCompareRow[];
  points: Map<string, Map<string, CacheEfficiencyPoint>>;
} {
  const points = new Map<string, Map<string, CacheEfficiencyPoint>>();
  for (const s of series) points.set(s.key, new Map(s.points.map((p) => [p.date, p])));
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const rows = dates.map((date) => {
    const row: CacheCompareRow = { date };
    for (const s of series) row[s.key] = points.get(s.key)?.get(date)?.hitRate;
    return row;
  });
  return { rows, points };
}
