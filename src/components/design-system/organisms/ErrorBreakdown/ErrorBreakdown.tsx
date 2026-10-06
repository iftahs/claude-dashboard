import { memo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { RankedMeterList } from '@/components/design-system/molecules/RankedMeterList/RankedMeterList';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { CHART_AXIS, CHART_ENTRANCE, CHART_GRID, chartMotionAllowed } from '@/lib/chart-theme';
import type { ErrorBreakdownProps, ErrorTrendTooltipState } from './types';
import {
  CATEGORY_LIST_LABEL,
  TOOL_LIST_LABEL,
  TREND_ACTIVE_DOT,
  TREND_AXIS_WIDTH,
  TREND_CHART_LABEL,
  TREND_CURSOR,
  TREND_HEIGHT,
  TREND_LINE_COLOR,
  TREND_MARGIN,
  TREND_SERIES,
  trendRows,
} from './utils';

function trendTooltip({ active, payload }: ErrorTrendTooltipState) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <ChartTooltip title={point.label} rows={trendRows(point)} />;
}

export const ErrorBreakdown = memo(function ErrorBreakdown({ view, className }: ErrorBreakdownProps) {
  const [played, setPlayed] = useState(false);

  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} ai={view.ai} className={className}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <GroupLabel as="span">By category</GroupLabel>
            <RankedMeterList ariaLabel={CATEGORY_LIST_LABEL} rows={view.categories} />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <GroupLabel as="span" note={view.toolsNote ?? undefined}>
              By tool
            </GroupLabel>
            <RankedMeterList ariaLabel={TOOL_LIST_LABEL} rows={view.tools} tone="danger" mono labelWidth="lg" />
          </div>
        </div>

        {view.trend.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-3 border-t border-line pt-5">
            <GroupLabel as="span">Failures per day</GroupLabel>
            <div role="img" aria-label={TREND_CHART_LABEL} className="w-full min-w-0" style={{ height: TREND_HEIGHT }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={view.trend} margin={TREND_MARGIN}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="label" {...CHART_AXIS} />
                  <YAxis width={TREND_AXIS_WIDTH} allowDecimals={false} {...CHART_AXIS} />
                  <Tooltip cursor={TREND_CURSOR} content={trendTooltip} />
                  <Line
                    type="monotone"
                    dataKey="errors"
                    name={TREND_SERIES}
                    stroke={TREND_LINE_COLOR}
                    strokeWidth={2}
                    dot={false}
                    activeDot={TREND_ACTIVE_DOT}
                    isAnimationActive={!played && chartMotionAllowed()}
                    onAnimationEnd={() => setPlayed(true)}
                    {...CHART_ENTRANCE}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        <p className="text-caption text-fg-subtle">{view.footnote}</p>
      </div>
    </Section>
  );
});
