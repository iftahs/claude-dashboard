import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { cn } from '@/lib/cn';
import type { EmptyStateProps } from './types';

export function EmptyState({ title, icon = 'inbox', description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex animate-fade-in flex-col items-center justify-center gap-2 py-12 text-center', className)}>
      <Icon name={icon} size={20} className="text-fg-subtle" />
      <p className="text-body font-medium text-fg">{title}</p>
      {description ? <p className="max-w-sm text-small text-fg-muted">{description}</p> : null}
      {action ? <div className="flex items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
