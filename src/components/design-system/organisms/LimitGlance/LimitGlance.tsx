import { memo, useId } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { EmptyState } from '@/components/design-system/molecules/EmptyState/EmptyState';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { cn } from '@/lib/cn';
import { LimitGlanceCap } from './LimitGlanceCap/LimitGlanceCap';
import { LimitGlanceWindow } from './LimitGlanceWindow/LimitGlanceWindow';
import type { LimitGlanceProps } from './types';
import { SKELETON_WINDOWS, SWATCH_CLASS } from './utils';

export const LimitGlance = memo(function LimitGlance({ view, href, onNavigate, className }: LimitGlanceProps) {
  const titleId = useId();
  const { status, windows, caps, message, note } = view;
  const ready = status === 'ready';
  const hasRows = windows.length > 0 || caps.length > 0;

  return (
    <Card aria-labelledby={titleId} className={cn('relative flex flex-col gap-4', href && 'hover:border-line-strong', className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={titleId} className="flex min-w-0 items-center gap-2 text-heading text-fg">
          <span aria-hidden="true" className={cn('size-2 flex-none rounded-[2px]', SWATCH_CLASS[view.platform])} />
          {href ? (
            <a
              href={href}
              aria-label={`${view.name} limits, open live usage`}
              onClick={(event) => onNavigate?.(event, href)}
              className="whitespace-nowrap outline-none after:absolute after:-inset-px after:rounded-card focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
            >
              {view.name}
            </a>
          ) : (
            <span className="whitespace-nowrap">{view.name}</span>
          )}
        </h3>
        {view.plan ? <Badge>{view.plan}</Badge> : null}
      </div>

      {status === 'loading' ? <SkeletonPreset variant="gauge" rows={SKELETON_WINDOWS} /> : null}

      {status === 'error' && message ? <ErrorState title={message.title} description={message.description} className="py-6" /> : null}

      {ready && message && !hasRows ? (
        <EmptyState icon="info" title={message.title} description={message.description} className="py-6" />
      ) : null}

      {ready && message && hasRows ? (
        <div className="flex flex-col gap-1">
          <p className="text-body font-medium text-fg">{message.title}</p>
          <p className="text-small text-fg-muted">{message.description}</p>
        </div>
      ) : null}

      {ready && windows.length > 0 ? (
        <div className="flex flex-col gap-5">
          {windows.map((row) => (
            <LimitGlanceWindow key={row.key} row={row} />
          ))}
        </div>
      ) : null}

      {ready && caps.length > 0 ? (
        <div className="flex flex-col gap-4">
          {caps.map((row) => (
            <LimitGlanceCap key={row.key} row={row} />
          ))}
        </div>
      ) : null}

      {ready && note ? <p className="text-caption text-fg-subtle">{note}</p> : null}
    </Card>
  );
});
