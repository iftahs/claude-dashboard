import type { HeatLevel } from '@/lib/views/trends';

export const GRID_LABEL = 'Effective tokens by hour and day of week';
export const GRID_CLASS = 'grid min-w-0 grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-0.5';
export const LEGEND_INSET = 'pl-[2.625rem]';
export const TOOLTIP_DELAY_MS = 150;
export const HEAT_LEVELS: readonly HeatLevel[] = [0, 1, 2, 3, 4];

export const HEAT_CLASS: Record<HeatLevel, string> = {
  0: 'bg-heat-0',
  1: 'bg-heat-1',
  2: 'bg-heat-2',
  3: 'bg-heat-3',
  4: 'bg-heat-4',
};
