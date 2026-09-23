export interface CacheEfficiencyPoint {
  date: string;
  hitRate: number;
  cacheReadTokens: number;
  totalTokens: number;
}

/** One platform's line when the chart compares platforms (the *Both* view). */
export interface CacheSeries {
  key: string;
  label: string;
  color: string;
  points: CacheEfficiencyPoint[];
}

export interface CacheEfficiencyChartProps {
  /** The single-line chart (one platform, or a pooled figure). */
  data?: CacheEfficiencyPoint[];
  /** Two or more lines, one per platform — takes precedence over `data`. */
  series?: CacheSeries[];
}

export interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: CacheEfficiencyPoint }>;
  label?: string;
}

/** One row of the multi-series chart: the date plus each series' point (absent = no usage that day). */
export interface CacheCompareRow {
  date: string;
  [key: string]: string | number | undefined;
}

export interface CompareTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CacheCompareRow }>;
  series: CacheSeries[];
  points: Map<string, Map<string, CacheEfficiencyPoint>>;
}
