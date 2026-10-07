import { memo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { RankedMeterList } from '@/components/design-system/molecules/RankedMeterList/RankedMeterList';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { CHART_ENTRANCE, chartMotionAllowed } from '@/lib/chart-theme';
import type { ModelBreakdownProps, ModelSliceTooltipState } from './types';
import {
  DONUT_INNER_RADIUS,
  DONUT_OUTER_RADIUS,
  DONUT_STROKE,
  EFFICIENCY_LABEL,
  LEGEND_LABEL,
  TOOLTIP_ESCAPE,
  TOOLTIP_WRAPPER,
  chartLabel,
  sliceRows,
} from './utils';

function sliceTooltip({ active, payload }: ModelSliceTooltipState) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;
  return <ChartTooltip title={slice.label} rows={sliceRows(slice)} />;
}

export const ModelBreakdown = memo(function ModelBreakdown({ view, className }: ModelBreakdownProps) {
  const [played, setPlayed] = useState(false);

  return (
    <Section
      title={view.title}
      description={view.description}
      help={view.help}
      as="h3"
      state={view.state}
      ai={view.ai}
      className={className}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-center gap-5">
          <div role="img" aria-label={chartLabel(view)} className="size-[180px] flex-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={view.slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={DONUT_INNER_RADIUS}
                  outerRadius={DONUT_OUTER_RADIUS}
                  stroke={DONUT_STROKE}
                  strokeWidth={2}
                  isAnimationActive={!played && chartMotionAllowed()}
                  onAnimationEnd={() => setPlayed(true)}
                  {...CHART_ENTRANCE}
                >
                  {view.slices.map((slice) => (
                    <Cell key={slice.id} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={sliceTooltip} allowEscapeViewBox={TOOLTIP_ESCAPE} wrapperStyle={TOOLTIP_WRAPPER} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul aria-label={LEGEND_LABEL} className="flex min-w-48 flex-1 flex-col gap-2">
            {view.slices.map((slice) => (
              <li key={slice.id} className="flex min-w-0 items-center justify-between gap-3">
                <LegendDot color={slice.color} className="min-w-0 text-small text-fg">
                  <span title={slice.label} className="min-w-0 truncate">
                    {slice.label}
                  </span>
                </LegendDot>
                <span className="flex-none whitespace-nowrap font-mono text-mono tabular-nums text-fg-muted">
                  {slice.tokens} · {slice.share}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {view.efficiency.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <GroupLabel as="span">{EFFICIENCY_LABEL}</GroupLabel>
            <RankedMeterList ariaLabel={EFFICIENCY_LABEL} rows={view.efficiency} />
          </div>
        ) : null}
      </div>
    </Section>
  );
});
