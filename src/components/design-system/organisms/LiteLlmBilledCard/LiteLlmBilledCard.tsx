import { memo } from 'react';
import { Callout } from '@/components/design-system/molecules/Callout/Callout';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { LiteLlmDailyChart } from './LiteLlmDailyChart/LiteLlmDailyChart';
import type { LiteLlmBilledCardProps } from './types';
import { MIX_LEGEND_LABEL, mixLabel } from './utils';

export const LiteLlmBilledCard = memo(function LiteLlmBilledCard({ view, className }: LiteLlmBilledCardProps) {
  const { month, mix } = view;

  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} className={className}>
      <div className="flex min-w-0 flex-col gap-5">
        <div className="grid min-w-0 gap-5 lg:grid-cols-3">
          {month ? (
            <div className="flex min-w-0 flex-col gap-3 rounded-control bg-surface-sunken p-4">
              <span title={month.label} className="truncate text-label uppercase text-fg-subtle">
                {month.label}
              </span>
              <span className="whitespace-nowrap text-metric-lg tabular-nums text-fg">{month.value}</span>
              <div className="flex min-w-0 flex-col gap-2">
                {month.facts.map((fact) => (
                  <KeyValueRow key={fact.key} label={fact.label} value={fact.value} tone={fact.tone} help={fact.help ?? undefined} />
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="truncate text-label uppercase text-fg-subtle">{view.windowLabel}</span>
              <span className="whitespace-nowrap font-mono text-mono tabular-nums text-fg">{view.windowTotal}</span>
            </div>
            <LiteLlmDailyChart days={view.days} ariaLabel={`${view.title}, ${view.windowLabel}, per day. ${view.windowTotal}.`} />
            {view.truncated ? <Callout tone="warning">{view.truncated}</Callout> : null}
          </div>
        </div>
        {mix ? (
          <div className="flex min-w-0 flex-col gap-2 border-t border-line pt-4">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="truncate text-label uppercase text-fg-subtle">{mix.label}</span>
              <span className="whitespace-nowrap font-mono text-mono tabular-nums text-fg-muted">{mix.total}</span>
            </div>
            <div role="img" aria-label={mixLabel(mix.segments)} className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-surface-hover">
              {mix.segments.map((segment) => (
                <span key={segment.key} style={{ width: `${segment.percent}%`, backgroundColor: segment.color }} />
              ))}
            </div>
            <Legend ariaLabel={MIX_LEGEND_LABEL} items={mix.segments} />
          </div>
        ) : null}
      </div>
    </Section>
  );
});
