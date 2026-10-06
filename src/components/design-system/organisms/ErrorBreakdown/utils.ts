import { compact } from '@/lib/format';
import type { ErrorTrendPointView } from '@/lib/views/insights';
import type { ErrorTrendTooltipRow } from './types';

export const CATEGORY_LIST_LABEL = 'Failures by category';
export const TOOL_LIST_LABEL = 'Failures by tool';
export const TREND_CHART_LABEL = 'Failed tool calls per day';
export const TREND_SERIES = 'Failed';
export const TREND_HEIGHT = 140;
export const TREND_AXIS_WIDTH = 36;
export const TREND_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
export const TREND_LINE_COLOR = 'rgb(var(--danger))';
export const TREND_CURSOR = { stroke: 'rgb(var(--border-strong))' } as const;
export const TREND_ACTIVE_DOT = { r: 4, fill: TREND_LINE_COLOR, stroke: 'rgb(var(--surface))', strokeWidth: 2 } as const;

export function trendRows(point: ErrorTrendPointView): ErrorTrendTooltipRow[] {
  return [
    { label: TREND_SERIES, value: compact(point.errors), color: TREND_LINE_COLOR },
    { label: 'Calls', value: compact(point.calls) },
  ];
}
