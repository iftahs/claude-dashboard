import { CHART_AXIS_TICK } from '@/lib/chart-theme';
import type { ComplexityScatterView, ComplexitySeriesView } from '@/lib/views/insights';
import type { ComplexityLegendItem } from './types';

export const CHART_HEIGHT = 300;
export const CHART_MARGIN = { top: 8, right: 16, bottom: 20, left: 0 } as const;
export const Y_WIDTH = 48;
export const X_NAME = 'Tool calls';
export const Y_NAME = 'Effective tokens';
export const LEGEND_LABEL = 'Platforms';
export const DOT_OPACITY = 0.65;
export const CURSOR = { stroke: 'rgb(var(--border-strong))', strokeDasharray: '3 3' } as const;
export const X_LABEL = {
  value: X_NAME,
  position: 'insideBottom',
  offset: -12,
  fill: CHART_AXIS_TICK.fill,
  fontSize: CHART_AXIS_TICK.fontSize,
} as const;

const MIN_DOT_AREA = 30;
const DOT_AREA_STEP = 40;
const MAX_DOT_AREA = 600;

export function dotRange(maxSize: number): [number, number] {
  return [MIN_DOT_AREA, Math.min(MIN_DOT_AREA + maxSize * DOT_AREA_STEP, MAX_DOT_AREA)];
}

export function legendItems(series: readonly ComplexitySeriesView[]): ComplexityLegendItem[] {
  return series.map((entry) => ({ key: entry.key, label: entry.label, color: entry.color, shape: 'round' }));
}

export function chartLabel(view: ComplexityScatterView): string {
  return `${view.title}. ${view.description}.`;
}
