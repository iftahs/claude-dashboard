import type { Bucket } from '@/types';

export type UsageBarMetric = 'tokens' | 'cost';

export type UsageBarRow = Record<string, number | string | boolean | null>;

export interface UsageBarSeries {
  key: string;
  label: string;
  color: string;
}

export interface UsageBarModel {
  rows: UsageBarRow[];
  series: UsageBarSeries[];
  todayLabel: string | null;
}

export interface UsageBarModelInput {
  buckets: readonly Bucket[];
  labelFor: (ms: number) => string;
  titleFor?: (ms: number) => string;
  metric: UsageBarMetric;
  projectionCostPerDay?: number;
  projectionTokensPerDay?: number;
  now: number;
}

export interface UsageBarFooterLine {
  label: string;
  value: string;
}

export interface UsageBarChartProps {
  buckets: readonly Bucket[];
  labelFor: (ms: number) => string;
  titleFor?: (ms: number) => string;
  metric?: UsageBarMetric;
  projectionCostPerDay?: number;
  projectionTokensPerDay?: number;
  now?: number;
  height?: number;
  ariaLabel?: string;
  className?: string;
}
