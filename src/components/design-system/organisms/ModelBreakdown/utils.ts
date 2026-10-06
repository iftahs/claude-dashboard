import type { ModelBreakdownView, ModelSliceView } from '@/lib/views/models';
import type { ModelSliceTooltipRow } from './types';

export const DONUT_INNER_RADIUS = 58;
export const DONUT_OUTER_RADIUS = 88;
export const DONUT_STROKE = 'rgb(var(--surface))';
export const LEGEND_LABEL = 'Effective tokens by model';
export const EFFICIENCY_LABEL = 'Est. cost per 1M effective tokens';

export function sliceRows(slice: ModelSliceView): ModelSliceTooltipRow[] {
  return [
    { label: 'Effective tokens', value: slice.tokens, color: slice.color },
    { label: 'Share', value: slice.share },
    { label: 'Incl. cache reads', value: slice.total },
  ];
}

export function chartLabel(view: ModelBreakdownView): string {
  const shares = view.slices.map((slice) => `${slice.label} ${slice.share}`).join(', ');
  return `${view.description}: ${shares}`;
}
