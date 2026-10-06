import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { usd } from '@/lib/format';
import { DAY_SPEND_LABEL, TODAY_TEXT } from '../utils';
import type { LiteLlmDailyTooltipProps } from './types';

export function LiteLlmDailyTooltip({ active, payload }: LiteLlmDailyTooltipProps) {
  const day = payload?.[0]?.payload;
  if (!active || !day) return null;

  return (
    <ChartTooltip
      title={
        <span className="flex items-center gap-1.5">
          {day.title}
          {day.today ? <Badge tone="success">{TODAY_TEXT}</Badge> : null}
        </span>
      }
      rows={[{ label: DAY_SPEND_LABEL, value: usd(day.cost) }, ...day.models]}
      footer={day.successful}
    />
  );
}
