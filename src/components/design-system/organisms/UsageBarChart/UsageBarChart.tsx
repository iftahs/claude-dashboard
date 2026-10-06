import { memo, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Rectangle, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import {
  CHART_AXIS,
  CHART_BAR_RADIUS,
  CHART_CURSOR,
  CHART_ENTRANCE,
  CHART_GRID,
  CHART_TODAY_LABEL,
  CHART_TODAY_LINE,
  chartMotionAllowed,
} from '@/lib/chart-theme';
import { cn } from '@/lib/cn';
import { UsageBarChartTooltip } from './UsageBarChartTooltip/UsageBarChartTooltip';
import type { UsageBarChartProps, UsageBarShapeProps } from './types';
import {
  ANIMATION_MAX_ROWS,
  CHART_MARGIN,
  DEFAULT_HEIGHT,
  LEGEND_LABEL,
  ROW_LABEL,
  STACK_ID,
  TODAY_TEXT,
  axisWidth,
  buildUsageBars,
  formatValue,
  legendInset,
  topSeries,
} from './utils';

export const UsageBarChart = memo(function UsageBarChart({
  buckets,
  labelFor,
  titleFor,
  metric = 'tokens',
  projectionCostPerDay,
  projectionTokensPerDay,
  now,
  height = DEFAULT_HEIGHT,
  fill = false,
  ariaLabel,
  className,
}: UsageBarChartProps) {
  const model = useMemo(
    () =>
      buildUsageBars({
        buckets,
        labelFor,
        titleFor,
        metric,
        projectionCostPerDay,
        projectionTokensPerDay,
        now: now ?? Date.now(),
      }),
    [buckets, labelFor, titleFor, metric, projectionCostPerDay, projectionTokensPerDay, now],
  );
  const [played, setPlayed] = useState(false);
  const animate = !played && model.rows.length <= ANIMATION_MAX_ROWS && chartMotionAllowed();

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-3', fill && 'min-h-0 flex-1', className)}>
      <div
        role="img"
        aria-label={ariaLabel}
        className={cn('relative w-full min-w-0', fill && 'flex-1')}
        style={fill ? { minHeight: height } : { height }}
      >
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.rows} margin={CHART_MARGIN}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey={ROW_LABEL} {...CHART_AXIS} />
              <YAxis tickFormatter={(value) => formatValue(Number(value), metric)} width={axisWidth(metric)} {...CHART_AXIS} />
              <Tooltip cursor={CHART_CURSOR} content={<UsageBarChartTooltip metric={metric} />} />
              {model.todayLabel ? (
                <ReferenceLine x={model.todayLabel} {...CHART_TODAY_LINE} label={{ value: TODAY_TEXT, ...CHART_TODAY_LABEL }} />
              ) : null}
              {model.series.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  stackId={STACK_ID}
                  fill={series.color}
                  isAnimationActive={animate}
                  onAnimationEnd={() => setPlayed(true)}
                  {...CHART_ENTRANCE}
                  shape={(shape: unknown) => {
                    const rect = shape as UsageBarShapeProps;
                    return <Rectangle {...rect} radius={topSeries(rect.payload, model.series) === series.key ? CHART_BAR_RADIUS : 0} />;
                  }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <Legend items={model.series} ariaLabel={LEGEND_LABEL} className={legendInset(metric)} />
    </div>
  );
});
