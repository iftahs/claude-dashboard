import type { CacheChartRow, CacheEfficiencyView, CacheSeriesView } from '@/lib/views/trends';

export interface CacheEfficiencyTooltipItem {
  payload?: CacheChartRow;
}

export interface CacheEfficiencyTooltipProps {
  series: readonly CacheSeriesView[];
  points: CacheEfficiencyView['points'];
  active?: boolean;
  payload?: readonly CacheEfficiencyTooltipItem[];
}
