import { memo } from 'react';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Select } from '@/components/design-system/atoms/Select/Select';
import { Table } from '@/components/design-system/atoms/Table/Table';
import { TableCell } from '@/components/design-system/atoms/TableCell/TableCell';
import { TableRow } from '@/components/design-system/atoms/TableRow/TableRow';
import { Callout } from '@/components/design-system/molecules/Callout/Callout';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { RankedMeterList } from '@/components/design-system/molecules/RankedMeterList/RankedMeterList';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { SessionUsagePanelProps } from './types';
import {
  BREAKDOWN_CAPTION,
  BREAKDOWN_LABEL,
  CONTRIBUTING_LABEL,
  CONTRIBUTORS_ARIA,
  LIMITS_LABEL,
  LINES_UNIT,
  MODEL_SHARES_LABEL,
  THIS_SESSION_LABEL,
  TIP_TITLE,
} from './utils';

export const SessionUsagePanel = memo(function SessionUsagePanel({ view, onSessionChange, as, className }: SessionUsagePanelProps) {
  const { picker } = view;

  return (
    <Section
      title={view.title}
      description={view.description ? <span title={view.description} className="block truncate">{view.description}</span> : undefined}
      help={view.help}
      as={as}
      state={view.state}
      className={className}
      actions={
        picker && onSessionChange ? (
          <Select
            ariaLabel={picker.label}
            size="sm"
            value={picker.value}
            onValueChange={onSessionChange}
            options={picker.options}
            className="w-44 sm:w-72"
          />
        ) : undefined
      }
    >
      <div className="flex min-w-0 flex-col gap-5">
        {view.limits.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-3">
            <GroupLabel as="h3">{LIMITS_LABEL}</GroupLabel>
            <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              {view.limits.map((row) => (
                <MeterRow key={row.key} size="sm" label={row.label} value={row.value} percent={row.percent} tone={row.tone} note={row.note} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-3">
          <GroupLabel as="h3">{THIS_SESSION_LABEL}</GroupLabel>
          <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {view.facts.map((fact) => (
              <KeyValueRow
                key={fact.key}
                label={fact.label}
                help={fact.help ?? undefined}
                value={
                  fact.changes ? (
                    <span title={fact.value}>
                      <span className="text-success-fg">{fact.changes.added}</span> <span className="text-danger-fg">{fact.changes.removed}</span>{' '}
                      {LINES_UNIT}
                    </span>
                  ) : (
                    fact.value
                  )
                }
              />
            ))}
          </div>
          {view.shares.length > 1 ? (
            <Legend ariaLabel={MODEL_SHARES_LABEL} items={view.shares.map((share) => ({ key: share.key, label: share.label, color: share.color, value: share.value }))} />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <GroupLabel as="h3">{BREAKDOWN_LABEL}</GroupLabel>
          <div className="min-w-0 overflow-x-auto rounded-control border border-line">
            <Table caption={BREAKDOWN_CAPTION} className="min-w-[520px]">
              <thead>
                <TableRow>
                  <TableCell header>Model</TableCell>
                  <TableCell header numeric>Input</TableCell>
                  <TableCell header numeric>Output</TableCell>
                  <TableCell header numeric>Cache read</TableCell>
                  <TableCell header numeric>Cache write</TableCell>
                  <TableCell header numeric>Cost</TableCell>
                </TableRow>
              </thead>
              <tbody>
                {view.models.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <ModelChip model={row.key} />
                    </TableCell>
                    <TableCell numeric>{row.input}</TableCell>
                    <TableCell numeric>{row.output}</TableCell>
                    <TableCell numeric>{row.cacheRead}</TableCell>
                    <TableCell numeric title={row.cacheWriteTitle ?? undefined}>
                      {row.cacheWrite}
                    </TableCell>
                    <TableCell numeric>{row.cost}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        </div>

        {view.contributors.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-3">
            <GroupLabel as="h3">{CONTRIBUTING_LABEL}</GroupLabel>
            <RankedMeterList
              ariaLabel={CONTRIBUTORS_ARIA}
              labelWidth="lg"
              rows={view.contributors.map((row) => ({ key: row.key, label: row.label, badge: row.badge, percent: row.percent, value: row.value }))}
            />
          </div>
        ) : null}

        {view.tip ? (
          <Callout tone="info" title={TIP_TITLE}>
            {view.tip}
          </Callout>
        ) : null}

        {view.partialNote ? <p className="text-caption text-fg-subtle">{view.partialNote}</p> : null}
      </div>
    </Section>
  );
});
