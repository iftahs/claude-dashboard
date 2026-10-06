import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { cn } from '@/lib/cn';
import type { LimitGlanceWindowProps } from './types';

export function LimitGlanceWindow({ row }: LimitGlanceWindowProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-body text-fg-muted">
          <span title={row.label} className="min-w-0 truncate">
            {row.label}
          </span>
          {row.binding ? <Badge tone={row.tone}>Binding limit</Badge> : null}
        </span>
        <span className={cn('flex-none whitespace-nowrap text-metric', row.tone === 'neutral' ? 'text-fg-muted' : 'text-fg')}>
          {row.value}
        </span>
      </div>
      <ProgressBar value={row.percent} tone={row.tone} size="lg" label={row.label} />
      <span className="flex flex-wrap gap-x-1 text-caption text-fg-subtle">
        {row.reset.map((phrase) => (
          <span key={phrase} className="whitespace-nowrap">
            {phrase}
          </span>
        ))}
      </span>
    </div>
  );
}
