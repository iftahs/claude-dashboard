import type { LiteLlmMixSegmentView } from '@/lib/views/trends';

export const CHART_HEIGHT = 200;
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
export const ANIMATION_MAX_ROWS = 60;
export const MIN_TICK_GAP = 24;
export const AXIS_WIDTH = 56;
export const ROW_LABEL = 'label';
export const ROW_COST = 'cost';
export const TODAY_TEXT = 'Today';
export const DAY_SPEND_LABEL = 'Day spend';
export const MIX_LEGEND_LABEL = 'Token mix';

export function mixLabel(segments: readonly LiteLlmMixSegmentView[]): string {
  return segments.map((segment) => `${segment.label} ${Math.round(segment.percent)}%`).join(', ');
}
