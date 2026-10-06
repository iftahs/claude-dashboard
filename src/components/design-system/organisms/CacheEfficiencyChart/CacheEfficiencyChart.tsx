import { memo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import { Section } from '@/components/design-system/organisms/Section/Section';
import {
  CHART_ACTIVE_DOT_STROKE,
  CHART_AXIS,
  CHART_ENTRANCE,
  CHART_GRID,
  CHART_LINE_CURSOR,
  CHART_LINE_WIDTH,
  CHART_REFERENCE_LABEL,
  CHART_REFERENCE_LINE,
  chartMotionAllowed,
} from '@/lib/chart-theme';
import { CacheEfficiencyTooltip } from './CacheEfficiencyTooltip/CacheEfficiencyTooltip';
import type { CacheEfficiencyChartProps } from './types';
import {
  ACTIVE_DOT_RADIUS,
  ANIMATION_MAX_ROWS,
  AXIS_WIDTH,
  CHART_HEIGHT,
  CHART_MARGIN,
  LEGEND_LABEL,
  MIN_TICK_GAP,
  PLOT_CLASS,
  RATE_DOMAIN,
  ROW_LABEL,
  averageLabel,
  percentTick,
} from './utils';

export const CacheEfficiencyChart = memo(function CacheEfficiencyChart({ view, className }: CacheEfficiencyChartProps) {
  const [played, setPlayed] = useState(false);
  const animate = !played && view.rows.length <= ANIMATION_MAX_ROWS && chartMotionAllowed();
  const first = view.series[0];

  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} className={className}>
      <div className="flex w-full min-w-0 flex-col gap-3">
        <dl className="flex min-w-0 flex-wrap gap-x-6 gap-y-1">
          {view.stats.map((stat) => (
            <div key={stat.key} className="flex items-baseline gap-1.5 whitespace-nowrap">
              <dt className="text-small text-fg-muted">{stat.label}</dt>
              <dd className="font-mono text-mono tabular-nums text-fg">{stat.value}</dd>
            </div>
          ))}
        </dl>
        <div
          role="img"
          aria-label={`${view.title}. ${view.description}.`}
          className={PLOT_CLASS}
          style={{ height: CHART_HEIGHT }}
        >
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={view.rows} margin={CHART_MARGIN}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey={ROW_LABEL} minTickGap={MIN_TICK_GAP} {...CHART_AXIS} />
                <YAxis domain={RATE_DOMAIN} tickFormatter={(value) => percentTick(Number(value))} width={AXIS_WIDTH} {...CHART_AXIS} />
                <Tooltip
                  cursor={CHART_LINE_CURSOR}
                  content={<CacheEfficiencyTooltip series={view.series} points={view.points} />}
                />
                {view.average !== null && first ? (
                  <ReferenceLine
                    y={view.average}
                    stroke={first.color}
                    {...CHART_REFERENCE_LINE}
                    label={{ value: averageLabel(view.average), ...CHART_REFERENCE_LABEL }}
                  />
                ) : null}
                {view.series.map((entry) => (
                  <Line
                    key={entry.key}
                    type="monotone"
                    dataKey={entry.key}
                    name={entry.label}
                    stroke={entry.color}
                    strokeWidth={CHART_LINE_WIDTH}
                    dot={false}
                    connectNulls={false}
                    activeDot={{ r: ACTIVE_DOT_RADIUS, fill: entry.color, stroke: CHART_ACTIVE_DOT_STROKE, strokeWidth: CHART_LINE_WIDTH }}
                    isAnimationActive={animate}
                    onAnimationEnd={() => setPlayed(true)}
                    {...CHART_ENTRANCE}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {view.series.length > 1 ? (
          <Legend
            ariaLabel={LEGEND_LABEL}
            className="pl-11"
            items={view.series.map((entry) => ({ key: entry.key, label: entry.label, color: entry.color, shape: 'round' }))}
          />
        ) : null}
      </div>
    </Section>
  );
});
