import type { GroupedBarDatum, GroupedBarUnit } from '../types';

export interface GroupedBarTooltipItem {
  name?: string | number;
  value?: number | string | readonly (number | string)[];
  color?: string;
  payload?: GroupedBarDatum;
}

export interface GroupedBarChartTooltipProps {
  unit: GroupedBarUnit;
  active?: boolean;
  payload?: readonly GroupedBarTooltipItem[];
}
