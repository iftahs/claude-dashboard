import { memo } from 'react';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Table } from '@/components/design-system/atoms/Table/Table';
import { TableCell } from '@/components/design-system/atoms/TableCell/TableCell';
import { TableRow } from '@/components/design-system/atoms/TableRow/TableRow';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { EffortBar } from './EffortBar/EffortBar';
import { EffortSliceList } from './EffortSliceList/EffortSliceList';
import type { EffortBreakdownProps } from './types';
import { ALL_MODELS_LABEL, LEGEND_LABEL, REASONING_LABEL, TABLE_CAPTION, legendItems } from './utils';

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

        <div className="overflow-x-auto rounded-control border border-line">
          <Table caption={TABLE_CAPTION}>
            <thead>
              <TableRow>
                <TableCell header>Model</TableCell>
                <TableCell header className="w-2/5 min-w-32">
                  Effort mix
                </TableCell>
                <TableCell header numeric>
                  Est. cost
                </TableCell>
                <TableCell header numeric>
                  Reasoning
                </TableCell>
              </TableRow>
            </thead>
            <tbody>
              {view.models.map((model) => (
                <TableRow key={model.key}>
                  <TableCell>
                    <ModelChip model={model.model} />
                  </TableCell>
                  <TableCell>
                    <Tooltip content={<EffortSliceList title={model.summary} slices={model.slices} />}>
                      <EffortBar slices={model.slices} name={model.summary} tabIndex={0} />
                    </Tooltip>
                  </TableCell>
                  <TableCell numeric>{model.cost}</TableCell>
                  <TableCell numeric>{model.reasoning}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </Section>
  );
});
