import { memo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_AXIS, CHART_BAR_RADIUS, CHART_CURSOR, CHART_GRID } from '@/lib/chart-theme';
import { LiteLlmDailyTooltip } from '../LiteLlmDailyTooltip/LiteLlmDailyTooltip';
import {
  ANIMATION_MAX_ROWS,
  AXIS_WIDTH,
  CHART_HEIGHT,
  CHART_MARGIN,
  MIN_TICK_GAP,
  PLOT_CLASS,
  ROW_COST,
  ROW_LABEL,
  axisValue,
} from '../utils';
import type { LiteLlmDailyChartProps } from './types';

export const LiteLlmDailyChart = memo(function LiteLlmDailyChart({ days, ariaLabel }: LiteLlmDailyChartProps) {
  return (
    <div role="img" aria-label={ariaLabel} className={PLOT_CLASS} style={{ height: CHART_HEIGHT }}>
      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[...days]} margin={CHART_MARGIN}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey={ROW_LABEL} interval="preserveStartEnd" minTickGap={MIN_TICK_GAP} {...CHART_AXIS} />
            <YAxis tickFormatter={(value) => axisValue(Number(value))} width={AXIS_WIDTH} {...CHART_AXIS} />
            <Tooltip cursor={CHART_CURSOR} content={<LiteLlmDailyTooltip />} />
            <Bar dataKey={ROW_COST} radius={CHART_BAR_RADIUS} isAnimationActive={days.length <= ANIMATION_MAX_ROWS}>
              {days.map((day) => (
                <Cell key={day.key} fill={day.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
