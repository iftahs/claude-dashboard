import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { cn } from '@/lib/cn';
import { rankedMeterLabelVariants, rankedMeterValueVariants } from './RankedMeterList.variants';
import type { RankedMeterListProps } from './types';
import { gridTemplate } from './utils';

export function RankedMeterList({
  rows,
  ariaLabel,
  tone = 'neutral',
  labelWidth = 'md',
  mono = false,
  className,
}: RankedMeterListProps) {
  if (rows.length === 0) return null;
  const secondary = rows.some((row) => row.secondary !== undefined);

  return (
    <ul
      aria-label={ariaLabel}
      className={cn('grid min-w-0 gap-x-3 gap-y-2', className)}
      style={{ gridTemplateColumns: gridTemplate(labelWidth, secondary) }}
    >
      {rows.map((row) => (
        <li key={row.key ?? row.label} className="col-span-full grid grid-cols-subgrid items-center">
          <span title={row.title ?? row.label} className="flex min-w-0 items-center gap-1.5">
            {row.color ? (
              <span aria-hidden="true" className="size-2 flex-none rounded-[2px]" style={{ backgroundColor: row.color }} />
            ) : null}
            <span className={rankedMeterLabelVariants({ mono })}>
              {row.label}
              {row.detail ? <span className="text-fg-subtle"> · {row.detail}</span> : null}
            </span>
            {row.badge ? <Badge className="flex-none">{row.badge}</Badge> : null}
          </span>
          <ProgressBar value={row.percent} tone={row.tone ?? tone} size="sm" label={row.label} />
          <span className={rankedMeterValueVariants({ tone: row.valueTone })}>{row.value}</span>
          {secondary ? (
            <span className={rankedMeterValueVariants({ tone: row.secondaryTone ?? 'subtle' })}>{row.secondary}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
