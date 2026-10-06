import type { ChartTooltipRow } from '@/components/design-system/molecules/ChartTooltip/types';
import { compact } from '@/lib/format';
import type { CacheEfficiencyView, CacheSeriesView } from '@/lib/views/trends';

export const CHART_HEIGHT = 200;
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
export const ANIMATION_MAX_ROWS = 60;
export const MIN_TICK_GAP = 28;
export const AXIS_WIDTH = 40;
export const RATE_DOMAIN: [number, number] = [0, 100];
export const ACTIVE_DOT_RADIUS = 4;
export const LEGEND_LABEL = 'Platforms';

export const ROW_LABEL = 'label';
export const ROW_DATE = 'date';
export const ROW_TITLE = 'title';

const NO_VALUE = '-';

export function percentTick(value: number): string {
  return `${Math.round(value)}%`;
}

export function averageLabel(average: number): string {
  return `Average ${Math.round(average)}%`;
}

export function tooltipRows(
  date: string,
  series: readonly CacheSeriesView[],
  points: CacheEfficiencyView['points'],
): ChartTooltipRow[] {
  const single = series.length === 1;
  const rows: ChartTooltipRow[] = [];
  for (const entry of series) {
    const point = points[entry.key]?.[date];
    rows.push({ label: entry.label, value: point ? `${point.hitRate.toFixed(1)}%` : NO_VALUE, color: entry.color });
    if (!point) continue;
    if (single) {
      rows.push({ label: 'Cache reads', value: compact(point.cacheReadTokens) });
      rows.push({ label: 'All tokens', value: compact(point.totalTokens) });
    } else {
      rows.push({
        label: 'Cache reads / all tokens',
        value: `${compact(point.cacheReadTokens)} / ${compact(point.totalTokens)}`,
      });
    }
  }
  return rows;
}
