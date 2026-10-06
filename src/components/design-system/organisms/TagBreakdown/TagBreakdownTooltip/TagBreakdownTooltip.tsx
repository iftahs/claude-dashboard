import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import type { TagBreakdownTooltipProps } from './types';

export function TagBreakdownTooltip({ active, payload }: TagBreakdownTooltipProps) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice?.label) return null;

  return <ChartTooltip rows={[{ label: slice.label, value: slice.valueLabel ?? '', color: slice.color }]} />;
}
