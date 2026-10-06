import type { TurnLatencyView } from '@/lib/views/insights';

export interface TurnLatencyProps {
  view: TurnLatencyView;
  className?: string;
}

export interface LatencyTooltipItem {
  name?: string | number;
  value?: number | string | readonly (number | string)[];
  color?: string;
}

export interface LatencyTooltipState {
  active?: boolean;
  payload?: readonly LatencyTooltipItem[];
  label?: string | number;
}

export interface LatencyTooltipRow {
  label: string;
  value: string;
  color?: string;
}
