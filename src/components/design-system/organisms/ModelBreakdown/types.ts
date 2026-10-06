import type { ModelBreakdownView, ModelSliceView } from '@/lib/views/models';

export interface ModelBreakdownProps {
  view: ModelBreakdownView;
  className?: string;
}

export interface ModelSliceTooltipItem {
  payload?: ModelSliceView;
}

export interface ModelSliceTooltipState {
  active?: boolean;
  payload?: readonly ModelSliceTooltipItem[];
}

export interface ModelSliceTooltipRow {
  label: string;
  value: string;
  color?: string;
}
