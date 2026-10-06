import { memo } from 'react';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { cn } from '@/lib/cn';
import { EffortBar } from './EffortBar/EffortBar';
import { EffortSliceList } from './EffortSliceList/EffortSliceList';
import type { EffortBreakdownProps } from './types';
import {
  ALL_MODELS_LABEL,
  COST_LABEL,
  LEGEND_LABEL,
  MODEL_LABEL,
  MODEL_LIST_LABEL,
  MODEL_REASONING_LABEL,
  REASONING_LABEL,
  ROW_GRID,
  legendItems,
} from './utils';

export const EffortBreakdown = memo(function EffortBreakdown({ view, className }: EffortBreakdownProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} as="h3" state={view.state} className={className}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <GroupLabel as="span">{ALL_MODELS_LABEL}</GroupLabel>
            <span className="whitespace-nowrap text-caption text-fg-muted">
              {REASONING_LABEL} <span className="font-mono text-fg">{view.reasoning}</span>
            </span>
          </div>
          <EffortBar slices={view.slices} size="md" name={ALL_MODELS_LABEL} />
          <Legend ariaLabel={LEGEND_LABEL} items={legendItems(view.slices)} />
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div aria-hidden="true" className={cn(ROW_GRID, 'text-label uppercase text-fg-subtle')}>
            <span>{MODEL_LABEL}</span>
            <span className="text-right">{COST_LABEL}</span>
            <span className="text-right">{MODEL_REASONING_LABEL}</span>
          </div>
          <ul aria-label={MODEL_LIST_LABEL} className="flex flex-col gap-3">
            {view.models.map((model) => (
              <li key={model.key} className={cn(ROW_GRID, 'items-center gap-y-1.5')}>
                <LegendDot color={model.color} shape="round" className="min-w-0 text-small text-fg">
                  <span title={model.model} className="min-w-0 truncate">
                    {model.label}
                  </span>
                </LegendDot>
                <span className="whitespace-nowrap text-right font-mono text-mono tabular-nums text-fg-muted">
                  <span className="sr-only">{COST_LABEL} </span>
                  {model.cost}
                </span>
                <span className="whitespace-nowrap text-right font-mono text-mono tabular-nums text-fg-muted">
                  <span className="sr-only">{MODEL_REASONING_LABEL} </span>
                  {model.reasoning}
                </span>
                <Tooltip content={<EffortSliceList title={model.summary} slices={model.slices} />}>
                  <EffortBar slices={model.slices} name={model.summary} tabIndex={0} className="col-span-full" />
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
});
