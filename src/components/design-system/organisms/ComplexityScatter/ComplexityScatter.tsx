import { memo } from 'react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { CHART_AXIS, CHART_GRID } from '@/lib/chart-theme';
import { compact } from '@/lib/format';
import type { ComplexityScatterProps, ComplexityTooltipState } from './types';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  CURSOR,
  DOT_OPACITY,
  LEGEND_LABEL,
  X_LABEL,
  X_NAME,
  Y_NAME,
  Y_WIDTH,
  chartLabel,
  dotRange,
  legendItems,
} from './utils';

function pointTooltip({ active, payload }: ComplexityTooltipState) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <ChartTooltip title={point.project} rows={point.rows} />;
}

export const ComplexityScatter = memo(function ComplexityScatter({ view, className }: ComplexityScatterProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} ai={view.ai} className={className}>
      <div className="flex min-w-0 flex-col gap-3">
        {view.split ? <Legend ariaLabel={LEGEND_LABEL} items={legendItems(view.series)} /> : null}
        <div role="img" aria-label={chartLabel(view)} className="w-full min-w-0" style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={CHART_MARGIN}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="toolCalls" name={X_NAME} type="number" allowDecimals={false} label={X_LABEL} {...CHART_AXIS} />
              <YAxis dataKey="effectiveTokens" name={Y_NAME} type="number" width={Y_WIDTH} tickFormatter={compact} {...CHART_AXIS} />
              <ZAxis dataKey="subagents" name={view.sizeLabel} domain={[0, view.maxSize]} range={dotRange(view.maxSize)} />
              <Tooltip cursor={CURSOR} content={pointTooltip} />
              {view.series.map((series) => (
                <Scatter
                  key={series.key}
                  name={series.label}
                  data={series.points}
                  fill={series.color}
                  fillOpacity={DOT_OPACITY}
                  isAnimationActive={false}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
});
