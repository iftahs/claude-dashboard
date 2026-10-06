import type { LiteLlmDayView } from '@/lib/views/trends';

export interface LiteLlmDailyChartProps {
  days: readonly LiteLlmDayView[];
  ariaLabel?: string;
}
