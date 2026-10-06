import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { ROW_DATE, ROW_TITLE, tooltipRows } from '../utils';
import type { CacheEfficiencyTooltipProps } from './types';

export function CacheEfficiencyTooltip({ series, points, active, payload }: CacheEfficiencyTooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return <ChartTooltip title={String(row[ROW_TITLE] ?? '')} rows={tooltipRows(String(row[ROW_DATE] ?? ''), series, points)} />;
}
