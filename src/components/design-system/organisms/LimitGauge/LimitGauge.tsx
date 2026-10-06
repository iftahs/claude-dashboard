import { memo } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Markdown } from '@/components/design-system/atoms/Markdown/Markdown';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { Callout } from '@/components/design-system/molecules/Callout/Callout';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { cn } from '@/lib/cn';
import type { LimitGaugeProps } from './types';
import { SKELETON_ROWS } from './utils';

export const LimitGauge = memo(function LimitGauge({ view, wideBelowXl = false, className }: LimitGaugeProps) {
  const { badge, meter, notice } = view;
  const loading = view.state?.kind === 'loading';

  return (
    <Section
      title={view.title}
      description={view.description}
      help={view.help}
      as="h3"
      state={loading ? null : view.state}
      className={className}
      actions={
        badge ? (
          <Badge tone={badge.tone}>
            {badge.live ? <StatusDot size="sm" pulse /> : null}
            {badge.label}
          </Badge>
        ) : undefined
      }
    >
      {loading ? (
        // Shaped like the loaded card (number, meter, fact rows, caption) so the cards below keep their place.
        <div className={cn('grid grid-cols-1 gap-5 pt-5', wideBelowXl && 'md:max-xl:grid-cols-2 md:max-xl:gap-x-8')}>
          <SkeletonPreset variant="gauge" rows={1} />
          <div aria-hidden="true" className="flex min-w-0 flex-col gap-2">
            <Skeleton className="mb-0.5 h-3 w-40" />
            {SKELETON_ROWS.map((width) => (
              <div key={width} className="flex h-5 items-center justify-between gap-3">
                <Skeleton width={width} height={12} />
                <Skeleton className="h-3 w-12 flex-none" />
              </div>
            ))}
          </div>
          <Skeleton className="my-0.5 h-3 w-48" />
        </div>
      ) : (
        <div className={cn('grid grid-cols-1 gap-5', wideBelowXl && 'md:max-xl:grid-cols-2 md:max-xl:gap-x-8')}>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="whitespace-nowrap text-metric-lg text-fg">{view.value}</span>
              <span className="text-small text-fg-muted">{view.caption}</span>
            </div>
            {meter ? <ProgressBar value={meter.percent} tone={meter.tone} size="lg" label={meter.label} /> : null}
            {meter?.caption ? <span className="text-caption text-fg-subtle">{meter.caption}</span> : null}
          </div>

          {view.rows.length > 0 ? (
            <div className={cn('flex min-w-0 flex-col gap-2', wideBelowXl && 'md:max-xl:row-span-2')}>
              <GroupLabel as="span">{view.rowsLabel}</GroupLabel>
              {view.rows.map((row) => (
                <KeyValueRow key={row.key} label={row.label} value={row.value} tone={row.tone} help={row.help ?? undefined} />
              ))}
            </div>
          ) : null}

          <div className="flex min-w-0 flex-col gap-5">
            {notice ? (
              <Callout tone="warning" title={notice.title}>
                <Markdown inline text={notice.description} />
              </Callout>
            ) : null}
            <div className="flex flex-col gap-1 text-caption text-fg-subtle">
              <p>{view.source}</p>
              {view.hint ? <p>{view.hint}</p> : null}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
});
