import { Button } from '@/components/design-system/atoms/Button/Button';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { cn } from '@/lib/cn';
import type { ErrorStateProps } from './types';

export function ErrorState({ title, description, detail, onRetry, retryLabel = 'Try again', className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex animate-fade-in flex-col items-center justify-center gap-2 py-12 text-center', className)}>
      <Icon name="alert" size={20} className="text-danger-fg" />
      <p className="text-body font-medium text-fg">{title}</p>
      {description ? <p className="max-w-sm text-small text-fg-muted">{description}</p> : null}
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          <Icon name="refresh" />
          {retryLabel}
        </Button>
      ) : null}
      {detail ? (
        <details className="w-full max-w-md">
          <summary className="mx-auto w-fit cursor-pointer rounded-control px-1 text-small text-fg-muted transition-colors duration-fast ease-standard hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Technical details
          </summary>
          <pre
            tabIndex={0}
            aria-label="Technical details"
            className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-control border border-line bg-surface-sunken p-2 text-left font-mono text-mono text-fg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {detail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
