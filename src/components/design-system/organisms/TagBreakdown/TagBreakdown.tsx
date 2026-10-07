import { memo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { CHART_ENTRANCE, chartMotionAllowed } from '@/lib/chart-theme';
import { TagBreakdownTooltip } from './TagBreakdownTooltip/TagBreakdownTooltip';
import type { TagBreakdownProps } from './types';
import { CHART_SIZE, INNER_RADIUS, LIST_LABEL, NO_COST, OUTER_RADIUS, SLICE_GAP_DEGREES } from './utils';

export const TagBreakdown = memo(function TagBreakdown({ view, className }: TagBreakdownProps) {
  const [played, setPlayed] = useState(false);

  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} className={className}>
      <div className="flex min-w-0 flex-col items-center gap-4">
        {view.slices.length > 0 ? (
          <div role="img" aria-label={view.chartLabel} className="flex-none" style={{ width: CHART_SIZE, height: CHART_SIZE }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={view.slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={INNER_RADIUS}
                  outerRadius={OUTER_RADIUS}
                  paddingAngle={view.slices.length > 1 ? SLICE_GAP_DEGREES : 0}
                  stroke="none"
                  isAnimationActive={!played && chartMotionAllowed()}
                  onAnimationEnd={() => setPlayed(true)}
                  {...CHART_ENTRANCE}
                >
                  {view.slices.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<TagBreakdownTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        <ul aria-label={LIST_LABEL} className="flex w-full min-w-0 flex-col gap-2">
          {view.groups.map((group) => (
            <li key={group.key} className="flex min-w-0 items-center justify-between gap-3">
              <LegendDot color={group.color} className="min-w-0">
                <span title={group.label} className="min-w-0 truncate text-small text-fg">
                  {group.label}
                </span>
              </LegendDot>
              <span className="flex flex-none items-baseline gap-2 whitespace-nowrap font-mono text-mono tabular-nums text-fg-muted">
                {group.cost ? (
                  <span>
                    {group.cost}
                    {group.share ? ` · ${group.share}` : null}
                  </span>
                ) : (
                  <span className="text-fg-subtle">{NO_COST}</span>
                )}
                <span className="text-fg-subtle">{group.tokens}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
});
