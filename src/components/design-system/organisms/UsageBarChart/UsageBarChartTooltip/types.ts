import type { UsageBarMetric, UsageBarRow } from '../types';

export interface UsageBarTooltipItem {
  name?: string | number;
  value?: number | string | readonly (number | string)[];
  color?: string;
  payload?: UsageBarRow;
}

export interface UsageBarChartTooltipProps {
  metric: UsageBarMetric;
  active?: boolean;
  payload?: readonly UsageBarTooltipItem[];
}
