import type { WeeklyData } from '@/types';
import type { SectionAiProps } from '@/hooks/useAiInsightContext';

export type DailyMetric = 'tokens' | 'cost';

export interface DailyTrendChartProps {
  data: WeeklyData | null;
  loading: boolean;
  weekDays: number;
  metric: DailyMetric;
  onMetricChange: (m: DailyMetric) => void;
  /** Drives the dotted projection past today. */
  costPerDay: number;
  /** AI-insight props for the wrapping Section (from useAiInsightCtx().aiProps). */
  ai: SectionAiProps;
}
