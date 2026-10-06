import type { DailyMetric, PlatformCompareView } from '@/lib/views/trends';

export interface PlatformDailyCompareChartProps {
  view: PlatformCompareView;
  onMetricChange: (metric: DailyMetric) => void;
  className?: string;
}
