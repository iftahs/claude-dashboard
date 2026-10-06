import { memo } from 'react';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { UsageBarChart } from '@/components/design-system/organisms/UsageBarChart/UsageBarChart';
import { dateTimeLabel, hourLabel } from '@/lib/format';
import type { HourlyUsageChartProps } from './types';

export const HourlyUsageChart = memo(function HourlyUsageChart({ view, className }: HourlyUsageChartProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} as="h3" grow state={view.state} className={className}>
      <UsageBarChart
        buckets={view.buckets}
        labelFor={hourLabel}
        titleFor={dateTimeLabel}
        fill
        ariaLabel={`${view.title}. ${view.description}.`}
      />
    </Section>
  );
});
