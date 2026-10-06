import type { HeatLevel } from '@/lib/views/trends';

export const GRID_LABEL = 'Effective tokens per day';
export const GRID_CLASS = 'grid min-w-[52rem] grid-cols-[2rem_repeat(18,minmax(0,1fr))] gap-1';
export const CAPTION =
  "Each square is one day; darker means more effective tokens. The numbers are the day of the month and that day's effective tokens.";
export const HEAT_LEVELS: readonly HeatLevel[] = [0, 1, 2, 3, 4];

export const HEAT_CLASS: Record<HeatLevel, string> = {
  0: 'bg-heat-0 text-fg-muted',
  1: 'bg-heat-1 text-fg',
  2: 'bg-heat-2 text-fg',
  3: 'bg-heat-3 text-fg',
  4: 'bg-heat-4 text-fg-on-accent',
};

export const FUTURE_CLASS = 'border border-dashed border-line text-fg-subtle';
export const LABEL_CLASS = 'sticky left-0 z-[1] bg-surface';
export const TOOLTIP_DELAY_MS = 150;
