import type { ExportFormat } from '@/lib/export';
import type { SectionAi } from '@/lib/section';
import type { DailyMetric, DailyTrendView } from '@/lib/views/trends';

export interface DailyTrendChartProps {
  view: DailyTrendView;
  onMetricChange: (metric: DailyMetric) => void;
  onExport: (format: ExportFormat) => void;
  ai?: SectionAi | null;
  className?: string;
}
