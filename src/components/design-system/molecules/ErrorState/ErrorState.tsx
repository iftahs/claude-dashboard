import { Button } from '@/components/design-system/atoms/Button/Button';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { cn } from '@/lib/cn';
import type { ErrorStateProps } from './types';

export function ErrorState({ title, description, onRetry, retryLabel = 'Try again', className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-2 py-12 text-center', className)}>
      <Icon name="alert" size={20} className="text-danger-fg" />
      <p className="text-body font-medium text-fg">{title}</p>
      {description ? <p className="max-w-sm text-small text-fg-muted">{description}</p> : null}
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          <Icon name="refresh" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
