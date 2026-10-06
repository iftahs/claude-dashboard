import { cn } from '@/lib/cn';
import type { GroupLabelProps } from './types';

export function GroupLabel({ children, as: Tag = 'h2', note, id, className }: GroupLabelProps) {
  return (
    <div className={cn('flex min-w-0 items-baseline gap-3', className)}>
      <Tag id={id} className="min-w-0 truncate text-label uppercase text-fg-subtle">
        {children}
      </Tag>
      {note ? <span className="min-w-0 truncate text-caption text-fg-subtle">{note}</span> : null}
    </div>
  );
}
