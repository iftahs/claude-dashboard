import type { EffortSliceView } from '@/lib/views/models';
import type { EffortLegendItem } from './types';

export const ALL_MODELS_LABEL = 'All models';
export const REASONING_LABEL = 'Reasoning share of output';
export const LEGEND_LABEL = 'Effort levels';
export const TABLE_CAPTION = 'Effort mix, estimated cost and reasoning share by model';

export function legendItems(slices: readonly EffortSliceView[]): EffortLegendItem[] {
  return slices.map((slice) => ({ key: slice.key, label: slice.label, color: slice.color, value: slice.detail }));
}

export function effortBarLabel(name: string, slices: readonly EffortSliceView[]): string {
  const mix = slices
    .filter((slice) => slice.percent > 0)
    .map((slice) => `${slice.label} ${slice.percent.toFixed(0)}%`)
    .join(', ');
  return mix ? `${name}: ${mix}` : name;
}
