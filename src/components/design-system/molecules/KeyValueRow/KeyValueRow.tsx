import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { cn } from '@/lib/cn';
import { keyValueRowValueVariants } from './KeyValueRow.variants';
import type { KeyValueRowProps } from './types';

export function KeyValueRow({ label, value, help, tone, className }: KeyValueRowProps) {
  return (
    <div className={cn('flex min-w-0 items-baseline justify-between gap-3', className)}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span title={label} className="min-w-0 truncate text-small text-fg-muted">
          {label}
        </span>
        {help ? <InfoTip label={`About ${label}`} content={help} /> : null}
      </span>
      <span className={keyValueRowValueVariants({ tone })}>{value}</span>
    </div>
  );
}
