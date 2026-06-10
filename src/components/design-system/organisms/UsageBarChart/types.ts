import type { Bucket } from '@/types';

export interface UsageBarChartProps {
  buckets: Bucket[];
  labelFor: (ms: number) => string;
  /** When provided, renders projected future bars for the next 3 days */
  projectionCostPerDay?: number;
  metric?: 'tokens' | 'cost';
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
    payload: {
      label: string;
      cost: number;
      isProjected?: boolean;
      [key: string]: string | number | boolean | undefined;
    };
  }>;
  label?: string;
  metric?: 'tokens' | 'cost';
}
