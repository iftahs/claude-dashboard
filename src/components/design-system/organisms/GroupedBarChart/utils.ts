import { compact, usd } from '@/lib/format';
import type { GroupedBarDatum, GroupedBarRow, GroupedBarSeries, GroupedBarUnit } from './types';

export const DEFAULT_HEIGHT = 240;
export const ANIMATION_MAX_ROWS = 60;
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
export const BAR_GAP = 2;
export const BAR_CATEGORY_GAP = '35%';
export const MAX_BAR_SIZE = 12;
export const MIN_TICK_GAP = 28;
export const LEGEND_LABEL = 'Series';
export const PLOT_CLASS = 'relative w-full min-w-0 [&_.recharts-surface]:overflow-visible';

export const ROW_LABEL = '__label';
export const ROW_TITLE = '__title';
export const ROW_FOOTER = '__footer';

const AXIS_WIDTH: Record<GroupedBarUnit, number> = { tokens: 44, cost: 56 };
const LEGEND_INSET: Record<GroupedBarUnit, string> = { tokens: 'pl-11', cost: 'pl-14' };

export function axisValue(value: number, unit: GroupedBarUnit): string {
  if (unit === 'cost') return value === 0 ? '$0' : usd(value);
  return compact(value);
}

export function readoutValue(value: number, unit: GroupedBarUnit): string {
  if (unit === 'cost') return value === 0 ? '~$0' : `~${usd(value)}`;
  return compact(value);
}

export function axisWidth(unit: GroupedBarUnit): number {
  return AXIS_WIDTH[unit];
}

export function legendInset(unit: GroupedBarUnit): string {
  return LEGEND_INSET[unit];
}

export function flattenRows(rows: readonly GroupedBarRow[], series: readonly GroupedBarSeries[]): GroupedBarDatum[] {
  return rows.map((row) => {
    const datum: GroupedBarDatum = {
      [ROW_LABEL]: row.label,
      [ROW_TITLE]: row.title,
      [ROW_FOOTER]: row.footer ?? null,
    };
    for (const entry of series) datum[entry.key] = row.values[entry.key] ?? 0;
    return datum;
  });
}
