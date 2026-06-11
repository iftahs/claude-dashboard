import type { ComplexityPoint } from '@/types';

export interface ComplexityScatterProps {
  data: ComplexityPoint[] | null;
}

export interface TooltipPayloadItem {
  payload: ComplexityPoint;
}

export interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}
