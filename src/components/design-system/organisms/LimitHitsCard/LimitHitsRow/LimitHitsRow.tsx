import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { cn } from '@/lib/cn';
import type { LimitHitsRowProps } from './types';

export function LimitHitsRow({ row }: LimitHitsRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <span title={row.kind} className="min-w-0 truncate text-body text-fg">
            {row.kind}
          </span>
          {row.model ? <ModelChip model={row.model} /> : null}
          {row.platform ? <LegendDot color={row.platform.color}>{row.platform.label}</LegendDot> : null}
        </div>
        <span className="whitespace-nowrap font-mono text-mono text-fg-subtle">{row.when}</span>
      </div>
      <span className={cn('flex-none whitespace-nowrap text-small', row.active ? 'font-medium text-danger-fg' : 'text-fg-muted')}>
        {row.status}
      </span>
    </li>
  );
}
