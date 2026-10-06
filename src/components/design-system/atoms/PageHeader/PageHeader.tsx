import { cn } from '@/lib/cn';
import type { PageHeaderProps } from './types';

export function PageHeader({ description, children, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex min-h-8 flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4', className)}>
      <div className="min-w-0 md:flex-1">
        {children ?? (description ? <p className="text-body text-fg-muted">{description}</p> : null)}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 md:flex-none md:flex-nowrap">{actions}</div> : null}
    </div>
  );
}
