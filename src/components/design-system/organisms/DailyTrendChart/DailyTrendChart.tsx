import { memo } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { ExportMenu } from '@/components/design-system/organisms/ExportMenu/ExportMenu';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { UsageBarChart } from '@/components/design-system/organisms/UsageBarChart/UsageBarChart';
import { dayLabel, dayLabelWithYear } from '@/lib/format';
import { DAILY_METRIC_OPTIONS, dayTitleWithYear } from '@/lib/views/trends';
import type { DailyTrendChartProps } from './types';
import { CHART_CLASS, METRIC_LABEL } from './utils';

export const DailyTrendChart = memo(function DailyTrendChart({
  view,
  onMetricChange,
  onExport,
  ai,
  className,
}: DailyTrendChartProps) {
  return (
    <Section
      title={view.title}
      description={
        view.delta ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {view.description}
            <Badge>
              {view.delta.up ? <Icon name="trending" size={12} /> : null}
              {view.delta.label}
            </Badge>
          </span>
        ) : (
          view.description
        )
      }
      help={view.help}
      state={view.state}
      ai={ai}
      className={className}
      actions={
        <>
          <SegmentedControl
            ariaLabel={METRIC_LABEL}
            size="sm"
            options={DAILY_METRIC_OPTIONS}
            value={view.metric}
            onChange={onMetricChange}
          />
          <ExportMenu onExport={onExport} disabled={!view.canExport} />
        </>
      }
    >
      <UsageBarChart
        buckets={view.buckets}
        labelFor={view.withYear ? dayLabelWithYear : dayLabel}
        titleFor={view.withYear ? dayTitleWithYear : dayLabel}
        metric={view.metric}
        projectionCostPerDay={view.costPerDay}
        projectionTokensPerDay={view.tokensPerDay}
        ariaLabel={`${view.title}. ${view.description}.`}
        className={CHART_CLASS}
      />
    </Section>
  );
});
