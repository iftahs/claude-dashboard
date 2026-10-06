import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAiInsightCtx } from './useAiInsightContext';
import { useConfigMode } from './useConfigMode';
import { useCostMetrics } from './useCostMetrics';
import { useExport } from './useExport';
import { useLiteLlmActual } from './useLiteLlmActual';
import { useLiveData, weeklyPollMs } from './useLiveData';
import { useRegisterPageExport } from './usePageActions';
import { usePolling } from './usePolling';
import { useSource } from './useSource';
import type { ExportFormat } from '@/lib/export';
import { buildSpendReport } from '@/lib/report';
import type { SectionAi } from '@/lib/section';
import {
  DEFAULT_TRENDS_VIEW,
  TRENDS_RANGE_OPTIONS,
  TRENDS_VIEWS,
  TRENDS_VIEW_PARAM,
  aiTrendsPayload,
  buildActivityHeatmap,
  buildActivitySummary,
  buildCacheEfficiency,
  buildCodexCompare,
  buildDailyTrend,
  buildLiteLlmBilled,
  buildPeakHours,
  buildPlatformCompare,
  buildSourcesSplit,
  buildSpendKpis,
  cacheSeriesFor,
  computeCodexSplit,
  computeSourceSplit,
  parseTrendsView,
  trendExport,
  type ActivityHeatmapView,
  type ActivitySummaryView,
  type CacheEfficiencyView,
  type CodexCompareView,
  type DailyMetric,
  type DailyTrendView,
  type LiteLlmBilledView,
  type PeakHoursView,
  type PlatformCompareView,
  type SourcesSplitView,
  type SpendKpisView,
  type TrendsOption,
  type TrendsViewId,
} from '@/lib/views/trends';
import type { ActivityData, DailyActivity, HeatmapData, UsageSummaryData, WeeklyData } from '@/types';

export interface TrendsPageView {
  view: TrendsViewId;
  views: readonly TrendsOption<TrendsViewId>[];
  onViewChange: (view: TrendsViewId) => void;
  range: string;
  rangeOptions: readonly TrendsOption[];
  onRangeChange: (value: string) => void;
  canExport: boolean;
  onExport: (format: ExportFormat) => void;
  kpis: SpendKpisView;
  billed: LiteLlmBilledView | null;
  platformCompare: PlatformCompareView | null;
  codexCompare: CodexCompareView | null;
  sources: SourcesSplitView | null;
  daily: DailyTrendView;
  dailyAi: SectionAi;
  onMetricChange: (metric: DailyMetric) => void;
  onDailyExport: (format: ExportFormat) => void;
  cache: CacheEfficiencyView;
  peakHours: PeakHoursView;
  summary: ActivitySummaryView;
  activity: ActivityHeatmapView;
}

interface PollLike {
  data: unknown;
  error: string | null;
}

const HEATMAP_POLL_MS = 60_000;
const ACTIVITY_POLL_MS = 30_000;
const SUMMARY_POLL_MS = 60_000;
const CODEX_UTC_POLL_MS = 60_000;
const NO_SERVER_DAYS: { date: string; tokens: number }[] = [];
const NO_LOCAL_DAYS: DailyActivity[] = [];

// A poll that was just switched on has neither data nor an error for one render; that is a first load, not a failure.
function waiting(poll: PollLike): boolean {
  return !poll.data && !poll.error;
}

export function useTrendsPage(): TrendsPageView {
  const { platform, showClaude, showCodex, showSurfaceToggle, source, withSrc, effectiveSource, codexAvailable } = useSource();
  const { litellmAvailable, litellmHost, weekStart } = useConfigMode();
  const { weekly, weekDays, setWeekDays, codexProfile, litellm } = useLiveData();
  const { costPerDay, coverageDays, daysLeftInMonth, projectedMonthCost } = useCostMetrics();
  const { litellmSpend } = useLiteLlmActual();
  const { sectionAi } = useAiInsightCtx();
  const exportData = useExport();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dailyMetric, setDailyMetric] = useState<DailyMetric>('tokens');

  const view = parseTrendsView(searchParams.get(TRENDS_VIEW_PARAM));
  const spendView = view === 'spend';
  const activityView = view === 'activity';
  const both = platform === 'both';

  // Under Both the shared weekly poll is unscoped, so the comparisons need their own two explicitly scoped polls.
  const scopedPolls = both && !activityView;
  const claudeWeekly = usePolling<WeeklyData>(
    scopedPolls ? `/api/usage/weekly?days=${weekDays}&source=claude` : '',
    weeklyPollMs(weekDays),
  );
  const codexWeekly = usePolling<WeeklyData>(
    scopedPolls ? `/api/usage/weekly?days=${weekDays}&source=codex` : '',
    weeklyPollMs(weekDays),
  );

  // OpenAI keys its daily count by UTC date; explicitly source=codex so it stays the Codex-side series under Both.
  const codexProfileOk = !!codexProfile.data && !codexProfile.data.error;
  const showCodexCompare = showCodex && codexAvailable && !codexProfile.data?.error;
  const codexUtcActivity = usePolling<ActivityData>(
    showCodexCompare && spendView ? `/api/activity?days=${weekDays}&source=codex&utc=1` : '',
    CODEX_UTC_POLL_MS,
  );

  const heatmap = usePolling<HeatmapData>(activityView ? withSrc('/api/heatmap?days=90') : '', HEATMAP_POLL_MS);
  const activity = usePolling<ActivityData>(activityView ? withSrc('/api/activity') : '', ACTIVITY_POLL_MS);
  const summary = usePolling<UsageSummaryData>(activityView ? withSrc('/api/usage/summary') : '', SUMMARY_POLL_MS);

  const weeklyData = weekly.data;
  const weeklyLoading = waiting(weekly);
  const coworkOnly = effectiveSource === 'cowork';

  const kpis = useMemo(
    () =>
      buildSpendKpis({
        weekly: weeklyData,
        loading: weeklyLoading,
        weekDays,
        platform,
        litellmAvailable,
        costPerDay,
        coverageDays,
        daysLeftInMonth,
        projectedMonthCost,
        now: Date.now(),
      }),
    [weeklyData, weeklyLoading, weekDays, platform, litellmAvailable, costPerDay, coverageDays, daysLeftInMonth, projectedMonthCost],
  );

  const billedVisible = showClaude && litellmAvailable;
  const billedLoading = waiting(litellm);
  const billed = useMemo(
    () =>
      billedVisible
        ? buildLiteLlmBilled({ spend: litellmSpend, loading: billedLoading, host: litellmHost, weekDays })
        : null,
    [billedVisible, litellmSpend, billedLoading, litellmHost, weekDays],
  );

  const claudeData = claudeWeekly.data;
  const codexData = codexWeekly.data;
  const scopedLoading = waiting(claudeWeekly) || waiting(codexWeekly);
  const scopedFailed = !claudeData && !codexData && !!(claudeWeekly.error || codexWeekly.error);
  const platformCompare = useMemo(
    () =>
      both
        ? buildPlatformCompare({ claude: claudeData, codex: codexData, loading: scopedLoading, weekDays, metric: dailyMetric })
        : null,
    [both, claudeData, codexData, scopedLoading, weekDays, dailyMetric],
  );

  const serverDays = codexProfileOk ? (codexProfile.data?.dailyUsage ?? NO_SERVER_DAYS) : NO_SERVER_DAYS;
  const localDays = codexUtcActivity.data?.dailyActivity ?? NO_LOCAL_DAYS;
  const codexCompareLoading = waiting(codexProfile) || waiting(codexUtcActivity);
  const codexCompareFailed = !codexUtcActivity.data && !!codexUtcActivity.error;
  const codexCompare = useMemo(
    () =>
      showCodexCompare
        ? buildCodexCompare({
            server: serverDays,
            local: localDays,
            loading: codexCompareLoading,
            failed: codexCompareFailed,
            days: weekDays,
            now: Date.now(),
          })
        : null,
    [showCodexCompare, serverDays, localDays, codexCompareLoading, codexCompareFailed, weekDays],
  );

  // Split by what the platform has: Code and Cowork, Codex threads and guardian reviews, or all three under Both. A Code-only user gets no split.
  const surfaceSplit = both || (showSurfaceToggle && source === 'all');
  const sources = useMemo(() => {
    if (!weeklyData) return null;
    if (platform === 'codex') {
      return buildSourcesSplit(weeklyData.codexSplit ? computeCodexSplit(weeklyData.codexSplit) : null, weekDays, platform);
    }
    if (!surfaceSplit) return null;
    return buildSourcesSplit(weeklyData.bySource ? computeSourceSplit(weeklyData.bySource) : null, weekDays, platform);
  }, [weeklyData, platform, surfaceSplit, weekDays]);

  const daily = useMemo(
    () =>
      buildDailyTrend({
        weekly: weeklyData,
        loading: weeklyLoading,
        weekDays,
        metric: dailyMetric,
        costPerDay,
        coverageDays,
        platform,
        coworkOnly,
      }),
    [weeklyData, weeklyLoading, weekDays, dailyMetric, costPerDay, coverageDays, platform, coworkOnly],
  );

  const aiPayload = useMemo(() => aiTrendsPayload(weeklyData), [weeklyData]);
  const dailyAi = useMemo(() => sectionAi('trends', aiPayload), [sectionAi, aiPayload]);

  // One line per platform under Both: a pooled rate would describe neither vendor's cache.
  const cacheLoading = both ? scopedLoading : weeklyLoading;
  const cacheFailed = both ? scopedFailed : !weeklyData && !!weekly.error;
  const cacheWeekly = both ? null : weeklyData;
  const cache = useMemo(
    () =>
      buildCacheEfficiency({
        series: cacheSeriesFor(platform, cacheWeekly, claudeData, codexData),
        loading: cacheLoading,
        failed: cacheFailed,
        weekDays,
        platform,
      }),
    [platform, cacheWeekly, claudeData, codexData, cacheLoading, cacheFailed, weekDays],
  );

  const grid = heatmap.data?.grid ?? null;
  const heatmapLoading = waiting(heatmap);
  const peakHours = useMemo(
    () => buildPeakHours({ grid, loading: heatmapLoading, weekStart, platform }),
    [grid, heatmapLoading, weekStart, platform],
  );

  const summaryData = summary.data;
  const summaryLoading = waiting(summary);
  const codexServerLifetime = codexProfileOk ? codexProfile.data?.lifetimeTokens : null;
  const activitySummary = useMemo(
    () => buildActivitySummary({ summary: summaryData, loading: summaryLoading, platform, codexServerLifetime }),
    [summaryData, summaryLoading, platform, codexServerLifetime],
  );

  const activityDays = activity.data?.dailyActivity ?? null;
  const activityLoading = waiting(activity);
  const activityHeatmap = useMemo(
    () => buildActivityHeatmap({ days: activityDays, loading: activityLoading, weekStart, platform, now: Date.now() }),
    [activityDays, activityLoading, weekStart, platform],
  );

  const getSpendReport = useCallback(
    () => (weeklyData ? buildSpendReport(weeklyData, weekDays, effectiveSource ?? 'all') : null),
    [weeklyData, weekDays, effectiveSource],
  );
  useRegisterPageExport(weeklyData ? getSpendReport : null);
  const onExport = useCallback((format: ExportFormat) => exportData(getSpendReport, format), [exportData, getSpendReport]);

  const getDailyExport = useCallback(() => (weeklyData ? trendExport(weeklyData, weekDays) : null), [weeklyData, weekDays]);
  const onDailyExport = useCallback((format: ExportFormat) => exportData(getDailyExport, format), [exportData, getDailyExport]);

  const onViewChange = useCallback(
    (next: TrendsViewId) => {
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        if (next === DEFAULT_TRENDS_VIEW) params.delete(TRENDS_VIEW_PARAM);
        else params.set(TRENDS_VIEW_PARAM, next);
        return params;
      });
    },
    [setSearchParams],
  );

  const onRangeChange = useCallback((value: string) => setWeekDays(Number(value)), [setWeekDays]);

  return {
    view,
    views: TRENDS_VIEWS,
    onViewChange,
    range: String(weekDays),
    rangeOptions: TRENDS_RANGE_OPTIONS,
    onRangeChange,
    canExport: !!weeklyData,
    onExport,
    kpis,
    billed,
    platformCompare,
    codexCompare,
    sources,
    daily,
    dailyAi,
    onMetricChange: setDailyMetric,
    onDailyExport,
    cache,
    peakHours,
    summary: activitySummary,
    activity: activityHeatmap,
  };
}
