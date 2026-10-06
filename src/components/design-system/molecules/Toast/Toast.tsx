import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { cn } from '@/lib/cn';
import { toastIconVariants } from './Toast.variants';
import type { ToastProps } from './types';
import { TOAST_ICONS } from './utils';

export function Toast({
  tone,
  title,
  description,
  onDismiss,
  action,
  dismissLabel = 'Dismiss',
  leaving = false,
  className,
}: ToastProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-hidden={leaving || undefined}
      className={cn(
        'flex w-[340px] max-w-full items-start gap-3 rounded-card border border-line bg-surface-raised px-4 py-3 shadow-pop',
        leaving ? 'animate-slide-out-right' : 'animate-slide-in-right',
        className,
      )}
    >
      <Icon name={TOAST_ICONS[tone]} className={toastIconVariants({ tone })} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-medium text-fg">{title}</span>
        {description ? <span className="text-small text-fg-muted">{description}</span> : null}
        {action ? <div className="mt-1.5 flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {onDismiss ? (
        <Tooltip content={dismissLabel}>
          <IconButton label={dismissLabel} onClick={onDismiss}>
            <Icon name="x" />
          </IconButton>
        </Tooltip>
      ) : null}
    </div>
  );
}
