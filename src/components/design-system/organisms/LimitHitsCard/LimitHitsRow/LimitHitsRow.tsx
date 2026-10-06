import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { cn } from '@/lib/cn';
import type { LimitHitsRowProps } from './types';

export function LimitHitsRow({ row }: LimitHitsRowProps) {
  return (
    <li className="flex flex-col gap-1.5 border-b border-line py-2.5 last:border-b-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span title={row.kind} className="min-w-0 truncate text-body text-fg">
          {row.kind}
        </span>
        <span className={cn('flex-none whitespace-nowrap text-small', row.active ? 'font-medium text-danger-fg' : 'text-fg-muted')}>
          {row.status}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="whitespace-nowrap font-mono text-mono text-fg-subtle">{row.when}</span>
        {row.model ? <ModelChip model={row.model} /> : null}
        {row.platform ? <LegendDot color={row.platform.color}>{row.platform.label}</LegendDot> : null}
      </div>
    </li>
  );
}
