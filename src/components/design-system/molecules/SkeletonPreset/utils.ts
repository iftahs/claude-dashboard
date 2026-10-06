import type { SkeletonPresetVariant } from './types';

const MAX_ROWS = 40;

const DEFAULT_ROWS: Record<SkeletonPresetVariant, number> = {
  text: 3,
  stat: 1,
  chart: 12,
  bars: 4,
  table: 5,
  gauge: 1,
};

const CHART_BAR_HEIGHTS = ['45%', '75%', '60%', '100%', '70%', '90%', '50%', '80%'];

const LABEL_WIDTHS = ['45%', '60%', '35%', '50%', '40%'];

export const TABLE_NUMERIC_COLUMNS = [0, 1, 2];

export function rowIndexes(variant: SkeletonPresetVariant, rows: number | undefined): number[] {
  const wanted = rows !== undefined && Number.isFinite(rows) ? Math.round(rows) : DEFAULT_ROWS[variant];
  const count = Math.min(MAX_ROWS, Math.max(1, wanted));
  return Array.from({ length: count }, (_, index) => index);
}

export function chartBarHeight(index: number): string {
  return CHART_BAR_HEIGHTS[index % CHART_BAR_HEIGHTS.length];
}

export function labelWidth(index: number): string {
  return LABEL_WIDTHS[index % LABEL_WIDTHS.length];
}

export function textLineWidth(index: number, count: number): string {
  return count > 1 && index === count - 1 ? '72%' : '100%';
}
