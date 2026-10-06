import { memo } from 'react';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { GroupedBarChart } from '@/components/design-system/organisms/GroupedBarChart/GroupedBarChart';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { DAILY_METRIC_OPTIONS } from '@/lib/views/trends';
import type { PlatformDailyCompareChartProps } from './types';
import { METRIC_LABEL } from './utils';

export const PlatformDailyCompareChart = memo(function PlatformDailyCompareChart({
  view,
  onMetricChange,
  className,
}: PlatformDailyCompareChartProps) {
  return (
    <Section
      title={view.title}
      description={view.description}
      help={view.help}
      state={view.state}
      className={className}
      actions={
        <SegmentedControl
          ariaLabel={METRIC_LABEL}
          size="sm"
          options={DAILY_METRIC_OPTIONS}
          value={view.metric}
          onChange={onMetricChange}
        />
      }
    >
      <GroupedBarChart
        rows={view.rows}
        series={view.legend}
        unit={view.metric}
        note={view.share}
        ariaLabel={`${view.title}. ${view.description}.`}
      />
    </Section>
  );
});
