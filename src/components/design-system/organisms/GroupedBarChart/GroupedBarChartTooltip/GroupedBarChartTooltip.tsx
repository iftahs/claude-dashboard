import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { ROW_FOOTER, ROW_TITLE, readoutValue } from '../utils';
import type { GroupedBarChartTooltipProps } from './types';

export function GroupedBarChartTooltip({ unit, active, payload }: GroupedBarChartTooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !payload || !row) return null;
  const footer = row[ROW_FOOTER];

  return (
    <ChartTooltip
      title={String(row[ROW_TITLE] ?? '')}
      rows={payload.map((item) => ({
        label: String(item.name ?? ''),
        value: readoutValue(Number(item.value) || 0, unit),
        color: item.color,
      }))}
      footer={typeof footer === 'string' && footer ? footer : undefined}
    />
  );
}
