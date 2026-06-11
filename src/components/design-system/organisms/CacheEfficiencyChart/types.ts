export interface CacheEfficiencyPoint {
  date: string;
  hitRate: number;
  cacheReadTokens: number;
  totalTokens: number;
}

export interface CacheEfficiencyChartProps {
  data: CacheEfficiencyPoint[];
}

export interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: CacheEfficiencyPoint }>;
  label?: string;
}
