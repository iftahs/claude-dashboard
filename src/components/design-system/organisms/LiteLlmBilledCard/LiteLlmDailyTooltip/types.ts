import type { LiteLlmDayView } from '@/lib/views/trends';

export interface LiteLlmDailyTooltipItem {
  payload?: LiteLlmDayView;
}

export interface LiteLlmDailyTooltipProps {
  active?: boolean;
  payload?: readonly LiteLlmDailyTooltipItem[];
}
