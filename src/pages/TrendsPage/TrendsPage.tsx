import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { Tabs } from '@/components/design-system/atoms/Tabs/Tabs';
import { ActivityHeatmap } from '@/components/design-system/organisms/ActivityHeatmap/ActivityHeatmap';
import { ActivitySummary } from '@/components/design-system/organisms/ActivitySummary/ActivitySummary';
import { CacheEfficiencyChart } from '@/components/design-system/organisms/CacheEfficiencyChart/CacheEfficiencyChart';
import { CodexDailyCompareChart } from '@/components/design-system/organisms/CodexDailyCompareChart/CodexDailyCompareChart';
import { DailyTrendChart } from '@/components/design-system/organisms/DailyTrendChart/DailyTrendChart';
import { ExportMenu } from '@/components/design-system/organisms/ExportMenu/ExportMenu';
import { LiteLlmBilledCard } from '@/components/design-system/organisms/LiteLlmBilledCard/LiteLlmBilledCard';
import { PeakHoursHeatmap } from '@/components/design-system/organisms/PeakHoursHeatmap/PeakHoursHeatmap';
import { PlatformDailyCompareChart } from '@/components/design-system/organisms/PlatformDailyCompareChart/PlatformDailyCompareChart';
import { SourcesSplitChart } from '@/components/design-system/organisms/SourcesSplitChart/SourcesSplitChart';
import { SpendKpiTiles } from '@/components/design-system/organisms/SpendKpiTiles/SpendKpiTiles';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { SectionStackLayout } from '@/components/design-system/templates/SectionStackLayout/SectionStackLayout';
import { StatGridLayout } from '@/components/design-system/templates/StatGridLayout/StatGridLayout';
import { useTrendsPage } from '@/hooks/useTrendsPage';

const TABS_ID = 'trends';
const TABS_LABEL = 'Trends views';
const RANGE_LABEL = 'Range';
const EXPORT_LABEL = 'Spend report';
const SUMMARY_LABEL = 'Activity summary';
const SUMMARY_NOTE = 'All history';

export function TrendsPage() {
  const page = useTrendsPage();

  return (
    <PageLayout
      header={
        <PageHeader
          actions={
            <>
              <SegmentedControl
                ariaLabel={RANGE_LABEL}
                size="sm"
                options={page.rangeOptions}
                value={page.range}
                onChange={page.onRangeChange}
              />
              <ExportMenu label={EXPORT_LABEL} onExport={page.onExport} disabled={!page.canExport} />
            </>
          }
        >
          <Tabs id={TABS_ID} ariaLabel={TABS_LABEL} items={page.views} value={page.view} onChange={page.onViewChange} />
        </PageHeader>
      }
    >
      <div
        role="tabpanel"
        id={`${TABS_ID}-panel-${page.view}`}
        aria-labelledby={`${TABS_ID}-tab-${page.view}`}
        className="flex min-w-0 flex-col gap-6"
      >
        {page.view === 'spend' ? (
          <>
            <StatGridLayout>
              <SpendKpiTiles view={page.kpis} />
            </StatGridLayout>
            {page.billed ? <LiteLlmBilledCard view={page.billed} /> : null}
            {page.platformCompare ? (
              <PlatformDailyCompareChart view={page.platformCompare} onMetricChange={page.onMetricChange} />
            ) : null}
            {page.codexCompare ? <CodexDailyCompareChart view={page.codexCompare} /> : null}
            {page.sources ? <SourcesSplitChart view={page.sources} /> : null}
            <DailyTrendChart
              view={page.daily}
              ai={page.dailyAi}
              onMetricChange={page.onMetricChange}
              onExport={page.onDailyExport}
            />
          </>
        ) : null}

        {page.view === 'efficiency' ? <CacheEfficiencyChart view={page.cache} /> : null}

        {page.view === 'activity' ? (
          <>
            <PeakHoursHeatmap view={page.peakHours} />
            {page.summary.status === 'hidden' ? null : (
              <SectionStackLayout title={<GroupLabel note={SUMMARY_NOTE}>{SUMMARY_LABEL}</GroupLabel>}>
                <StatGridLayout>
                  <ActivitySummary view={page.summary} />
                </StatGridLayout>
              </SectionStackLayout>
            )}
            <ActivityHeatmap view={page.activity} />
          </>
        ) : null}
      </div>
    </PageLayout>
  );
}
