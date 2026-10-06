import { cn } from '@/lib/cn';
import type { LimitHitsFigureProps } from './types';

export function LimitHitsFigure({ figure }: LimitHitsFigureProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt title={figure.label} className="truncate text-label uppercase text-fg-subtle">
        {figure.label}
      </dt>
      <dd className="flex min-w-0 flex-col gap-1">
        <span className={cn('whitespace-nowrap text-metric', figure.alert ? 'text-danger-fg' : 'text-fg')}>{figure.value}</span>
        <span className="text-caption text-fg-muted">{figure.note}</span>
      </dd>
    </div>
  );
}
