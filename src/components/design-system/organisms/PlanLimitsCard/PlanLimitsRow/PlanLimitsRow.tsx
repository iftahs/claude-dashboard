import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
import { cn } from '@/lib/cn';
import { PlanLimitsSurfaces } from '../PlanLimitsSurfaces/PlanLimitsSurfaces';
import { FORECAST_CLASS } from '../utils';
import type { PlanLimitsRowProps } from './types';

export function PlanLimitsRow({ row }: PlanLimitsRowProps) {
  const { forecast, surfaces } = row;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <MeterRow label={row.label} value={row.value} percent={row.percent} tone={row.tone} note={row.note} />
      {forecast ? (
        <span className={cn('flex items-center gap-1 text-caption', FORECAST_CLASS[forecast.tone])}>
          <Icon name={forecast.willExceed ? 'alert' : 'trending'} size={12} className="flex-none" />
          {forecast.label}
        </span>
      ) : null}
      {surfaces.length > 1 ? <PlanLimitsSurfaces surfaces={surfaces} /> : null}
    </div>
  );
}
