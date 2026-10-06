import type { ComplexityPointView, ComplexityScatterView } from '@/lib/views/insights';

export interface ComplexityScatterProps {
  view: ComplexityScatterView;
  className?: string;
}

export interface ComplexityTooltipItem {
  payload?: ComplexityPointView;
}

export interface ComplexityTooltipState {
  active?: boolean;
  payload?: readonly ComplexityTooltipItem[];
}

export interface ComplexityLegendItem {
  key: string;
  label: string;
  color: string;
  shape: 'round';
}
