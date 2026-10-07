import { memo, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import { CHART_AXIS, CHART_BAR_RADIUS, CHART_CURSOR, CHART_ENTRANCE, CHART_GRID, chartMotionAllowed } from '@/lib/chart-theme';
import { cn } from '@/lib/cn';
import { GroupedBarChartTooltip } from './GroupedBarChartTooltip/GroupedBarChartTooltip';
import type { GroupedBarChartProps } from './types';
import {
  ANIMATION_MAX_ROWS,
  BAR_CATEGORY_GAP,
  BAR_GAP,
  CHART_MARGIN,
  DEFAULT_HEIGHT,
  LEGEND_LABEL,
  MAX_BAR_SIZE,
  MIN_TICK_GAP,
  PLOT_CLASS,
  ROW_LABEL,
  axisValue,
  axisWidth,
  flattenRows,
  legendInset,
} from './utils';

export const GroupedBarChart = memo(function GroupedBarChart({
  rows,
  series,
  unit = 'tokens',
  note,
  height = DEFAULT_HEIGHT,
  ariaLabel,
  className,
}: GroupedBarChartProps) {
  const data = useMemo(() => flattenRows(rows, series), [rows, series]);
  const [played, setPlayed] = useState(false);
  const animate = !played && data.length <= ANIMATION_MAX_ROWS && chartMotionAllowed();

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-3', className)}>
      <div role="img" aria-label={ariaLabel} className={PLOT_CLASS} style={{ height }}>
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={CHART_MARGIN} barGap={BAR_GAP} barCategoryGap={BAR_CATEGORY_GAP}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey={ROW_LABEL} minTickGap={MIN_TICK_GAP} {...CHART_AXIS} />
              <YAxis tickFormatter={(value) => axisValue(Number(value), unit)} width={axisWidth(unit)} {...CHART_AXIS} />
              <Tooltip cursor={CHART_CURSOR} content={<GroupedBarChartTooltip unit={unit} />} />
              {series.map((entry) => (
                <Bar
                  key={entry.key}
                  dataKey={entry.key}
                  name={entry.label}
                  fill={entry.color}
                  radius={CHART_BAR_RADIUS}
                  maxBarSize={MAX_BAR_SIZE}
                  isAnimationActive={animate}
                  onAnimationEnd={() => setPlayed(true)}
                  {...CHART_ENTRANCE}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className={cn('flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1', legendInset(unit))}>
        <Legend items={series} ariaLabel={LEGEND_LABEL} />
        {note ? <span className="whitespace-nowrap text-caption text-fg-muted">{note}</span> : null}
      </div>
    </div>
  );
});
