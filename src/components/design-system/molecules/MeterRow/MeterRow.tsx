import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { cn } from '@/lib/cn';
import { meterRowLabelVariants } from './MeterRow.variants';
import type { MeterRowProps } from './types';

export function MeterRow({ label, value, percent, tone, note, size = 'md', className }: MeterRowProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span title={label} className={meterRowLabelVariants({ size })}>
          {label}
        </span>
        <span className="flex-none whitespace-nowrap font-mono text-mono text-fg-muted">{value}</span>
      </div>
      <ProgressBar value={percent} tone={tone} size={size} label={label} />
      {note ? <span className="text-caption text-fg-subtle">{note}</span> : null}
    </div>
  );
}
