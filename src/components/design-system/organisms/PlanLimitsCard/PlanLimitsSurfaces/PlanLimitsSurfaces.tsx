import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import { PLAN_SURFACE_HELP } from '@/lib/views/live';
import { SURFACE_CAPTION, SURFACE_HELP_LABEL, SURFACE_LEGEND_LABEL } from '../utils';
import type { PlanLimitsSurfacesProps } from './types';

export function PlanLimitsSurfaces({ surfaces }: PlanLimitsSurfacesProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
      <div aria-hidden="true" className="flex h-1 w-full overflow-hidden rounded-full bg-surface-hover">
        {surfaces.map((surface) => (
          <div key={surface.key} style={{ width: `${surface.percent}%`, backgroundColor: surface.color }} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1 whitespace-nowrap text-caption text-fg-subtle">
          {SURFACE_CAPTION}
          <InfoTip label={SURFACE_HELP_LABEL} content={PLAN_SURFACE_HELP} />
        </span>
        <Legend
          ariaLabel={SURFACE_LEGEND_LABEL}
          items={surfaces.map((surface) => ({
            key: surface.key,
            label: surface.label,
            color: surface.color,
            value: `${Math.round(surface.percent)}%`,
          }))}
        />
      </div>
    </div>
  );
}
