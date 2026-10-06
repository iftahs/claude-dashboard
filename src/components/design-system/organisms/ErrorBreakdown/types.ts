import type { ErrorBreakdownView, ErrorTrendPointView } from '@/lib/views/insights';

export interface ErrorBreakdownProps {
  view: ErrorBreakdownView;
  className?: string;
}

export interface ErrorTrendTooltipItem {
  payload?: ErrorTrendPointView;
}

export interface ErrorTrendTooltipState {
  active?: boolean;
  payload?: readonly ErrorTrendTooltipItem[];
}

export interface ErrorTrendTooltipRow {
  label: string;
  value: string;
  color?: string;
}
