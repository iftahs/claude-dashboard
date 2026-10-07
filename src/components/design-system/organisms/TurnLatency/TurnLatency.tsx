import { memo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { Table } from '@/components/design-system/atoms/Table/Table';
import { TableCell } from '@/components/design-system/atoms/TableCell/TableCell';
import { TableRow } from '@/components/design-system/atoms/TableRow/TableRow';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { CHART_AXIS, CHART_BAR_RADIUS, CHART_CURSOR, CHART_ENTRANCE, CHART_GRID, chartMotionAllowed } from '@/lib/chart-theme';
import { cn } from '@/lib/cn';
import type { LatencyTooltipState, TurnLatencyProps } from './types';
import {
  AXIS_WIDTH,
  CHART_HEIGHT,
  CHART_LABEL,
  CHART_MARGIN,
  HISTOGRAM_LABEL,
  LEGEND_LABEL,
  STACK_ID,
  TABLE_CAPTION,
  histogramRows,
} from './utils';

function histogramTooltip({ active, payload, label }: LatencyTooltipState) {
  if (!active || !payload || payload.length === 0) return null;
  return <ChartTooltip title={label} rows={histogramRows(payload)} />;
}

export const TurnLatency = memo(function TurnLatency({ view, className }: TurnLatencyProps) {
  const split = view.platforms.length > 0;
  const top = view.series.length - 1;
  const [played, setPlayed] = useState(false);

  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} ai={view.ai} className={className}>
      <div className={cn('grid grid-cols-1 gap-6', !split && 'xl:grid-cols-5')}>
        <div className={cn('flex min-w-0 flex-col gap-3', !split && 'xl:col-span-2')}>
          {split ? (
            <div className="overflow-x-auto rounded-control border border-line">
              <Table caption={TABLE_CAPTION}>
                <thead>
                  <TableRow>
                    <TableCell header>Platform</TableCell>
                    <TableCell header numeric>
                      Turns
                    </TableCell>
                    <TableCell header numeric>
                      Median
                    </TableCell>
                    <TableCell header numeric>
                      p90
                    </TableCell>
                    <TableCell header numeric>
                      First token
                    </TableCell>
                  </TableRow>
                </thead>
                <tbody>
                  {view.platforms.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>
                        <LegendDot color={row.color}>{row.label}</LegendDot>
                      </TableCell>
                      <TableCell numeric>{row.turns}</TableCell>
                      <TableCell numeric className="text-fg">
                        {row.median}
                      </TableCell>
                      <TableCell numeric>{row.p90}</TableCell>
                      <TableCell numeric>{row.firstToken}</TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {view.facts.map((fact) => (
                <KeyValueRow key={fact.key} label={fact.label} value={fact.value} tone={fact.tone} help={fact.help ?? undefined} />
              ))}
            </div>
          )}
          <p className="text-caption text-fg-subtle">{view.totals}</p>
        </div>

        <div className={cn('flex min-w-0 flex-col gap-3', !split && 'xl:col-span-3')}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <GroupLabel as="span">{HISTOGRAM_LABEL}</GroupLabel>
            {view.series.length > 1 ? <Legend ariaLabel={LEGEND_LABEL} items={view.series} /> : null}
          </div>
          <div role="img" aria-label={CHART_LABEL} className="w-full min-w-0" style={{ height: CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={view.histogram} margin={CHART_MARGIN}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="label" interval={0} {...CHART_AXIS} />
                <YAxis width={AXIS_WIDTH} allowDecimals={false} {...CHART_AXIS} />
                <Tooltip cursor={CHART_CURSOR} content={histogramTooltip} />
                {view.series.map((series, index) => (
                  <Bar
                    key={series.key}
                    dataKey={series.key}
                    name={series.label}
                    stackId={STACK_ID}
                    fill={series.color}
                    radius={index === top ? CHART_BAR_RADIUS : undefined}
                    isAnimationActive={!played && chartMotionAllowed()}
                    onAnimationEnd={() => setPlayed(true)}
                    {...CHART_ENTRANCE}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Section>
  );
});
