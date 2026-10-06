import { useMemo, useState } from 'react';
import { ActivityHeatmap } from '@/components/design-system/organisms/ActivityHeatmap/ActivityHeatmap';
import { ActivitySummary } from '@/components/design-system/organisms/ActivitySummary/ActivitySummary';
import { CacheEfficiencyChart } from '@/components/design-system/organisms/CacheEfficiencyChart/CacheEfficiencyChart';
import { CodexDailyCompareChart } from '@/components/design-system/organisms/CodexDailyCompareChart/CodexDailyCompareChart';
import { DailyTrendChart } from '@/components/design-system/organisms/DailyTrendChart/DailyTrendChart';
import { GroupedBarChart } from '@/components/design-system/organisms/GroupedBarChart/GroupedBarChart';
import { LiteLlmBilledCard } from '@/components/design-system/organisms/LiteLlmBilledCard/LiteLlmBilledCard';
import { PeakHoursHeatmap } from '@/components/design-system/organisms/PeakHoursHeatmap/PeakHoursHeatmap';
import { PlatformDailyCompareChart } from '@/components/design-system/organisms/PlatformDailyCompareChart/PlatformDailyCompareChart';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { SourcesSplitChart } from '@/components/design-system/organisms/SourcesSplitChart/SourcesSplitChart';
import { SpendKpiTiles } from '@/components/design-system/organisms/SpendKpiTiles/SpendKpiTiles';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { StatGridLayout } from '@/components/design-system/templates/StatGridLayout/StatGridLayout';
import type { SectionAi } from '@/lib/section';
import type { DailyMetric } from '@/lib/views/trends';
import { Specimen } from '../../Specimen/Specimen';
import {
  ACTIVITY_VIEWS,
  BILLED_VIEWS,
  CACHE_STATE_VIEWS,
  CACHE_VIEWS,
  CODEX_COMPARE_VIEWS,
  DAILY_STATE_VIEWS,
  GROUPED_ROWS,
  GROUPED_SERIES,
  KPI_VIEWS,
  PEAK_VIEWS,
  PLATFORM_STATE_VIEWS,
  SOURCES_VIEWS,
  SUMMARY_VIEWS,
  dailyView,
  platformView,
} from './utils';

function ignore(): void {}

const IDLE_AI: SectionAi = { onAsk: ignore };

export function TrendsSpecimens() {
  const [metric, setMetric] = useState<DailyMetric>('tokens');
  const daily = useMemo(() => dailyView(metric), [metric]);
  const platform = useMemo(() => platformView(metric), [metric]);

  return (
    <>
      <Specimen name="SpendKpiTiles" note="Both platforms with the split lines, one platform, loading and failed" layout="stack">
        {KPI_VIEWS.map((view, index) => (
          <StatGridLayout key={index}>
            <SpendKpiTiles view={view} />
          </StatGridLayout>
        ))}
      </Specimen>
      <Specimen
        name="DailyTrendChart"
        note="Thirty days by model with projected days. The switch is shared with the platform chart below. Then loading, empty and failed."
        layout="stack"
      >
        <DailyTrendChart view={daily} onMetricChange={setMetric} onExport={ignore} ai={IDLE_AI} />
        <SplitLayout>
          {DAILY_STATE_VIEWS.map((view, index) => (
            <DailyTrendChart key={index} view={view} onMetricChange={ignore} onExport={ignore} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="PlatformDailyCompareChart" note="Claude beside Codex, then loading and empty" layout="stack">
        <PlatformDailyCompareChart view={platform} onMetricChange={setMetric} />
        <SplitLayout>
          {PLATFORM_STATE_VIEWS.map((view, index) => (
            <PlatformDailyCompareChart key={index} view={view} onMetricChange={ignore} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="CodexDailyCompareChart" note="Server count beside local rollouts, then nothing to compare yet" layout="stack">
        {CODEX_COMPARE_VIEWS.map((view, index) => (
          <CodexDailyCompareChart key={index} view={view} />
        ))}
      </Specimen>
      <Specimen name="GroupedBarChart" note="The bare chart in a card: two series in estimated cost with totals and a note" layout="stack">
        <Section title="Est. cost per day" description="Two series side by side, last 14 days" as="h3">
          <GroupedBarChart
            rows={GROUPED_ROWS}
            series={GROUPED_SERIES}
            unit="cost"
            note="44% Codex"
            ariaLabel="Est. cost per day, Claude beside Codex, last 14 days"
          />
        </Section>
      </Specimen>
      <Specimen name="SourcesSplitChart" note="Three surfaces, then Codex thread kinds with an unpriced part" layout="stack">
        <SplitLayout>
          {SOURCES_VIEWS.map((view) => (
            <SourcesSplitChart key={view.title} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen
        name="CacheEfficiencyChart"
        note="One series with its average line, one line per platform with a gap on idle days, then loading, empty and failed"
        layout="stack"
      >
        <SplitLayout>
          {CACHE_VIEWS.map((view, index) => (
            <CacheEfficiencyChart key={index} view={view} />
          ))}
        </SplitLayout>
        <SplitLayout columns={3}>
          {CACHE_STATE_VIEWS.map((view, index) => (
            <CacheEfficiencyChart key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="PeakHoursHeatmap" note="A working week, then loading and empty" layout="stack">
        <PeakHoursHeatmap view={PEAK_VIEWS[0]} />
        <SplitLayout>
          {PEAK_VIEWS.slice(1).map((view, index) => (
            <PeakHoursHeatmap key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="ActivitySummary" note="Both platforms with the OpenAI line, then loading" layout="stack">
        {SUMMARY_VIEWS.map((view, index) => (
          <StatGridLayout key={index}>
            <ActivitySummary view={view} />
          </StatGridLayout>
        ))}
      </Specimen>
      <Specimen name="ActivityHeatmap" note="Eighteen weeks with every heat step and upcoming days, then loading" layout="stack">
        {ACTIVITY_VIEWS.map((view, index) => (
          <ActivityHeatmap key={index} view={view} />
        ))}
      </Specimen>
      <Specimen name="LiteLlmBilledCard" note="A month with a partial-history warning, then loading and failed" layout="stack">
        <LiteLlmBilledCard view={BILLED_VIEWS[0]} />
        <SplitLayout>
          {BILLED_VIEWS.slice(1).map((view, index) => (
            <LiteLlmBilledCard key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
    </>
  );
}
