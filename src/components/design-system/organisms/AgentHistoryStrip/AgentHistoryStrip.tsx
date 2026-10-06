import { memo } from 'react';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { cn } from '@/lib/cn';
import { AgentHistoryStat } from './AgentHistoryStat/AgentHistoryStat';
import type { AgentHistoryStripProps } from './types';

export const AgentHistoryStrip = memo(function AgentHistoryStrip({ view, className }: AgentHistoryStripProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} as="h3" className={className}>
      <div className={cn('grid min-w-0 grid-cols-1 gap-5 *:min-w-0', !view.stacked && 'md:grid-cols-2 md:gap-8')}>
        <dl className="flex flex-col divide-y divide-line">
          {view.stats.map((stat) => (
            <AgentHistoryStat key={stat.key} stat={stat} />
          ))}
        </dl>
        <div className="flex flex-col gap-3">
          <GroupLabel as="span">By type</GroupLabel>
          {view.types.map((row) => (
            <MeterRow key={row.type} size="sm" tone="neutral" label={row.label} value={row.count} percent={row.percent} />
          ))}
          {view.moreTypes ? <p className="text-caption text-fg-subtle">{`+${view.moreTypes}`}</p> : null}
        </div>
      </div>
    </Section>
  );
});
