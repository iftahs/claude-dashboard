import type { InsightsErrors } from '@/types';

export interface ErrorBreakdownProps {
  data: InsightsErrors | null;
}

export interface TooltipPayloadItem {
  payload: { date: string; calls: number; errors: number };
}

export interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}
