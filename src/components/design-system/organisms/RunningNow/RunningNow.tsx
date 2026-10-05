import { memo } from 'react';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { cn } from '@/lib/cn';
import { RunningNowRow } from './RunningNowRow/RunningNowRow';
import { RunningNowStat } from './RunningNowStat/RunningNowStat';
import type { RunningNowProps } from './types';
import { SKELETON_ROWS, moreLabel } from './utils';

export const RunningNow = memo(function RunningNow({ view, href, onNavigate, className }: RunningNowProps) {
  const { status, stats, rows, more, message } = view;
  const ready = status === 'ready';

  return (
    <Card aria-label="Running now" className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-2">
          {ready ? stats.map((stat) => <RunningNowStat key={stat.key} stat={stat} />) : null}
        </div>
        <a
          href={href}
          onClick={(event) => onNavigate?.(event, href)}
          className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-tag text-small font-medium text-accent-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Open agents
          <Icon name="arrowUpRight" size={14} />
        </a>
      </div>

      {status === 'loading' ? <SkeletonPreset variant="text" rows={SKELETON_ROWS} className="mt-3" /> : null}

      {status === 'error' && message ? <ErrorState title={message.title} description={message.description} className="py-6" /> : null}

      {ready && rows.length > 0 ? (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {rows.map((row) => (
            <RunningNowRow key={row.key} row={row} />
          ))}
        </ul>
      ) : null}

      {ready && rows.length === 0 ? (
        <p className="mt-3 border-t border-line pt-3 text-small text-fg-muted">Nothing is running right now.</p>
      ) : null}

      {ready && more > 0 ? <p className="border-t border-line pt-3 text-caption text-fg-subtle">{moreLabel(more)}</p> : null}
    </Card>
  );
});
