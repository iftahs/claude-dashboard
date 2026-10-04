import type { WeeklyData } from '@/types';
import type { SectionAiProps } from '@/hooks/useAiInsightContext';
import type { DailyMetric } from '@/lib/views/trends';

export interface DailyTrendChartProps {
  data: WeeklyData | null;
  loading: boolean;
  weekDays: number;
  metric: DailyMetric;
  onMetricChange: (m: DailyMetric) => void;
  /** Drives the dotted projection past today. */
  costPerDay: number;
  /** Average effective tokens per day of history (the bars' unit) — drives the token projection. */
  tokensPerDay?: number;
  /** AI-insight props for the wrapping Section (from useAiInsightCtx().aiProps). */
  ai: SectionAiProps;
  /** Platform suffix for the title (`titleScope(platform)`); '' under Claude. */
  scope?: string;
}
