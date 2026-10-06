import { memo } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { Callout } from '@/components/design-system/molecules/Callout/Callout';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { LimitGaugeProps } from './types';

export const LimitGauge = memo(function LimitGauge({ view, className }: LimitGaugeProps) {
  const { badge, meter, notice } = view;

  return (
    <Section
      title={view.title}
      description={view.description}
      help={view.help}
      as="h3"
      state={view.state}
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
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="whitespace-nowrap text-metric-lg text-fg">{view.value}</span>
            <span className="text-small text-fg-muted">{view.caption}</span>
          </div>
          {meter ? <ProgressBar value={meter.percent} tone={meter.tone} size="lg" label={meter.label} /> : null}
          {meter?.caption ? <span className="text-caption text-fg-subtle">{meter.caption}</span> : null}
        </div>

        <div className="flex flex-col gap-2">
          <GroupLabel as="span">{view.rowsLabel}</GroupLabel>
          {view.rows.map((row) => (
            <KeyValueRow key={row.key} label={row.label} value={row.value} tone={row.tone} help={row.help ?? undefined} />
          ))}
        </div>

        {notice ? (
          <Callout tone="warning" title={notice.title}>
            {notice.description}
          </Callout>
        ) : null}

        <div className="flex flex-col gap-1 text-caption text-fg-subtle">
          <p>{view.source}</p>
          {view.hint ? <p>{view.hint}</p> : null}
        </div>
      </div>
    </Section>
  );
});
