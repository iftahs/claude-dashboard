import { memo } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { Sparkline } from '@/components/design-system/atoms/Sparkline/Sparkline';
import { EmptyState } from '@/components/design-system/molecules/EmptyState/EmptyState';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { cn } from '@/lib/cn';
import type { SpendTodayProps } from './types';
import { SKELETON_BARS, TREND_CAPTION } from './utils';

export const SpendToday = memo(function SpendToday({ view, className }: SpendTodayProps) {
  const { status, message, cap, legend } = view;
  const loading = status === 'loading';
  const ready = status === 'ready';

  return (
    <Card aria-label={view.label} className={cn('flex flex-col', className)}>
      <div className="flex items-start justify-between gap-4">
        {loading ? (
          <SkeletonPreset variant="stat" className="py-2" />
        ) : (
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 title={view.label} className="truncate text-label uppercase text-fg-subtle">
              {view.label}
            </h3>
            {ready ? (
              <>
                <span className="whitespace-nowrap text-metric-lg text-fg">{view.value}</span>
                <span className="flex min-w-0 items-center gap-2 text-small text-fg-muted">
                  {view.delta ? (
                    <Badge>
                      {view.deltaUp ? <Icon name="trending" size={12} /> : null}
                      {view.delta}
                    </Badge>
                  ) : null}
                  <span title={view.comparison} className="min-w-0 truncate">
                    {view.comparison}
                  </span>
                </span>
              </>
            ) : null}
          </div>
        )}
        {loading ? (
          <div aria-hidden="true" className="w-[120px] flex-none">
            <SkeletonPreset variant="chart" rows={SKELETON_BARS} className="h-9" />
          </div>
        ) : null}
        {ready ? (
          <div className="flex w-[120px] flex-none flex-col gap-1">
            <Sparkline values={view.trend} highlightLast label={view.trendLabel} />
            <span className="whitespace-nowrap text-right text-caption text-fg-subtle">{TREND_CAPTION}</span>
          </div>
        ) : null}
      </div>

      {status === 'error' && message ? <ErrorState title={message.title} description={message.description} className="py-6" /> : null}

      {status === 'empty' && message ? <EmptyState title={message.title} description={message.description} className="py-6" /> : null}

      {loading || ready ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          {ready && cap ? (
            <MeterRow label={cap.label} value={cap.value} percent={cap.percent} tone={cap.tone} note={cap.note} />
          ) : null}
          {ready && legend.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {legend.map((entry) => (
                <LegendDot key={entry.key} color={entry.color} value={entry.value}>
                  {entry.name}
                </LegendDot>
              ))}
            </div>
          ) : null}
          <p className="text-caption text-fg-subtle">{view.footnote}</p>
        </div>
      ) : null}
    </Card>
  );
});
