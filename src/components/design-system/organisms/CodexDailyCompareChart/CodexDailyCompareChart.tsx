import { memo } from 'react';
import { GroupedBarChart } from '@/components/design-system/organisms/GroupedBarChart/GroupedBarChart';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { CodexDailyCompareChartProps } from './types';
import { CHART_HEIGHT } from './utils';

export const CodexDailyCompareChart = memo(function CodexDailyCompareChart({ view, className }: CodexDailyCompareChartProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} className={className}>
      <GroupedBarChart
        rows={view.rows}
        series={view.legend}
        note={view.delta}
        height={CHART_HEIGHT}
        ariaLabel={`${view.title}. ${view.description}.`}
      />
    </Section>
  );
});
