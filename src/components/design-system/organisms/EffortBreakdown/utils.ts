import type { EffortSliceView } from '@/lib/views/models';
import type { EffortLegendItem } from './types';

export const ALL_MODELS_LABEL = 'All models';
export const REASONING_LABEL = 'Reasoning share of output';
export const LEGEND_LABEL = 'Effort levels';
export const MODEL_LIST_LABEL = 'Effort mix by model';
export const MODEL_LABEL = 'Model';
export const COST_LABEL = 'Est. cost';
export const MODEL_REASONING_LABEL = 'Reasoning';
export const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_5rem_6rem] gap-x-3';

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
