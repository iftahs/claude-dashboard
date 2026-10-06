import { compact } from '@/lib/format';
import type { LatencyTooltipItem, LatencyTooltipRow } from './types';

export const CHART_HEIGHT = 180;
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
export const AXIS_WIDTH = 40;
export const STACK_ID = 'turns';
export const HISTOGRAM_LABEL = 'Turns by duration';
export const CHART_LABEL = 'Number of turns in each duration range';
export const LEGEND_LABEL = 'Platforms';
export const TABLE_CAPTION = 'Turn latency by platform';

export function histogramRows(payload: readonly LatencyTooltipItem[]): LatencyTooltipRow[] {
  return payload.map((item) => ({
    label: String(item.name ?? ''),
    value: compact(Number(item.value) || 0),
    color: item.color,
  }));
}
