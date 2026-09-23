import { useMemo, useState } from 'react';
import { StatCard } from '@/components/design-system/atoms/StatCard/StatCard';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { ExportButton } from '@/components/design-system/molecules/ExportButton/ExportButton';
import { CacheEfficiencyChart } from '@/components/design-system/organisms/CacheEfficiencyChart/CacheEfficiencyChart';
import type { CacheSeries } from '@/components/design-system/organisms/CacheEfficiencyChart/types';
import { PeakHoursHeatmap } from '@/components/design-system/organisms/PeakHoursHeatmap/PeakHoursHeatmap';
import { ActivityHeatmap } from '@/components/design-system/organisms/ActivityHeatmap/ActivityHeatmap';
import { ActivitySummary } from '@/components/design-system/organisms/ActivitySummary/ActivitySummary';
import { LiteLlmActualBilled } from '@/components/design-system/organisms/LiteLlmActualBilled/LiteLlmActualBilled';
import { CodexDailyCompareChart } from '@/components/design-system/organisms/CodexDailyCompareChart/CodexDailyCompareChart';
import { SourcesSplitChart } from '@/components/design-system/organisms/SourcesSplitChart/SourcesSplitChart';
import {
  computeCodexSplit,
  computeSourceSplit,
  sourcesHelp,
} from '@/components/design-system/organisms/SourcesSplitChart/utils';
import { PlatformDailyCompareChart } from '@/components/design-system/organisms/PlatformDailyCompareChart/PlatformDailyCompareChart';
import { CLAUDE_COLOR, CODEX_COLOR } from '@/components/design-system/organisms/PlatformDailyCompareChart/utils';
import { DailyTrendChart } from '@/components/design-system/organisms/DailyTrendChart/DailyTrendChart';
import type { DailyMetric } from '@/components/design-system/organisms/DailyTrendChart/types';
import { StatCardSkeleton, HeatmapSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact, usd, shortModel } from '@/lib/format';
import { titleScope } from '@/lib/platform';
import { buildSpendReport } from '@/lib/report';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { useConfigMode } from '@/hooks/useConfigMode';
import { useLiveData, weeklyPollMs } from '@/hooks/useLiveData';
import { useCostMetrics } from '@/hooks/useCostMetrics';
import { useLiteLlmActual } from '@/hooks/useLiteLlmActual';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import type { ActivityData, HeatmapData, UsageSummaryData, WeeklyData } from '@/types';
import {
  PLATFORM_NOUN,
  TIME_WINDOWS,
  aiTrendsPayload,
  cacheEfficiencyHelp,
  costBasisHelp,
  effectiveTokensHelp,
  platformSplitLabel,
  prevPeriodLabel,
  topModelByCost,
} from './utils';

/** A stat card's own sub-text, with the Claude/Codex split on a second line. */
function SplitSub({ sub, split }: { sub: string; split: string | null }) {
  if (!split) return <>{sub}</>;
  return (
    <>
      {sub}
      <span className="mt-0.5 block text-xs text-zinc-500">{split}</span>
    </>
  );
}

// Same sections, same order, on every platform — only the data and platform-specific copy change.
export function TrendsTab() {
  const { platform, showClaude, showCodex, showSurfaceToggle, source, withSrc, effectiveSource, codexAvailable } =
    useSource();
  const { litellmAvailable, litellmHost, weekStart } = useConfigMode();
  const { weekly, weekDays, setWeekDays, codexProfile } = useLiveData();
  const { costPerDay, coverageDays, daysLeftInMonth, projectedMonthCost, weeklyEffective, prevWeeklyEffective } =
    useCostMetrics();
  const { litellmSpend } = useLiteLlmActual();
  const { aiProps } = useAiInsightCtx();
  const [dailyMetric, setDailyMetric] = useState<DailyMetric>('tokens');

  const heatmap = usePolling<HeatmapData>(withSrc('/api/heatmap?days=90'), 60000);
  const activity = usePolling<ActivityData>(withSrc('/api/activity'), 30000);
  const summary = usePolling<UsageSummaryData>(withSrc('/api/usage/summary'), 60000);
  const noun = PLATFORM_NOUN[platform];
  const scope = titleScope(platform);
  const topModel = topModelByCost(weekly.data?.byModel);

  // Under *Both* the shared weekly poll is deliberately unscoped, so the
  // comparisons need their own two explicitly-scoped polls; an empty URL issues no request.
  const bothActive = platform === 'both';
  const claudeWeekly = usePolling<WeeklyData>(
    bothActive ? `/api/usage/weekly?days=${weekDays}&source=claude` : '',
    weeklyPollMs(weekDays),
  );
  const codexWeekly = usePolling<WeeklyData>(
    bothActive ? `/api/usage/weekly?days=${weekDays}&source=codex` : '',
    weeklyPollMs(weekDays),
  );

  // OpenAI keys its daily count by UTC date; explicitly source=codex so it stays the Codex-side panel under Both.
  const codexProfileOk = !!codexProfile.data && !codexProfile.data.error;
  const showCodexCompare = showCodex && codexAvailable && !codexProfile.data?.error;
  const codexUtcActivity = usePolling<ActivityData>(
    showCodexCompare ? `/api/activity?days=${weekDays}&source=codex&utc=1` : '',
    60_000, // slow-moving, and the server series it sits beside is cached for 30 min
  );

  // Sub-labels splitting each card between the two platforms — only under Both,
  // where the card total is a sum. On a single platform it already IS that one.
  const bs = bothActive ? weekly.data?.bySource : undefined;
  const daysThisMonth = new Date().getDate() + daysLeftInMonth;

  // Split by what the platform has: Code/Cowork, Codex threads/guardian, or all three under Both; Code-only users never reach a branch, unchanged.
  const splitSegments = useMemo(() => {
    const w = weekly.data;
    if (!w) return null;
    if (platform === 'codex') return w.codexSplit ? computeCodexSplit(w.codexSplit) : null;
    if (bothActive || (showSurfaceToggle && source === 'all')) return w.bySource ? computeSourceSplit(w.bySource) : null;
    return null;
  }, [weekly.data, platform, bothActive, showSurfaceToggle, source]);

  // One line per platform under Both — a pooled rate would describe neither vendor's cache.
  const cacheSeries = useMemo<CacheSeries[] | null>(() => {
    if (!bothActive) return null;
    return [
      { key: 'claude', label: 'Claude', color: CLAUDE_COLOR, points: claudeWeekly.data?.cacheEfficiency ?? [] },
      { key: 'codex', label: 'Codex', color: CODEX_COLOR, points: codexWeekly.data?.cacheEfficiency ?? [] },
    ];
  }, [bothActive, claudeWeekly.data, codexWeekly.data]);
  const hasCacheData = cacheSeries
    ? cacheSeries.some((s) => s.points.length > 0)
    : (weekly.data?.cacheEfficiency?.length ?? 0) > 0;

  return (
    <>
      {/* Window selector — drives the cost stat cards, the estimate chart,
          and (when present) the server-side charts. */}
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          Spending{scope} · last {weekDays} days
        </span>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10">
            {TIME_WINDOWS.map(({ days, label }) => (
              <button
                key={days}
                onClick={() => setWeekDays(days)}
                className={`px-2.5 py-1 text-xs tabular-nums transition-colors ${
                  weekDays === days ? 'bg-clay-500/20 text-clay-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <ExportButton
            label="Spend report"
            getData={() =>
              weekly.data ? buildSpendReport(weekly.data, weekDays, effectiveSource ?? 'all') : null
            }
          />
        </div>
      </div>
      {/* Cost stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {weekly.loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label={`Est. equivalent cost · ${weekDays}d`}
              value={usd(weekly.data?.totals.cost ?? 0)}
              sub={
                <SplitSub
                  sub={topModel ? `top: ${shortModel(topModel.model)} · ${topModel.pct}%` : ''}
                  split={platformSplitLabel(bs, 'cost', usd)}
                />
              }
              help={costBasisHelp(platform, litellmAvailable)}
            />
            <StatCard
              label={`Effective tokens · last ${weekDays} days`}
              value={compact(weeklyEffective)}
              sub={
                <SplitSub
                  sub={
                    prevWeeklyEffective > 0
                      ? `${prevPeriodLabel(weekDays)}: ${compact(prevWeeklyEffective)}`
                      : `${compact(weekly.data?.totals.outputTokens ?? 0)} output`
                  }
                  split={platformSplitLabel(bs, 'effectiveTokens', compact)}
                />
              }
              help={effectiveTokensHelp(platform)}
            />
            <StatCard
              label="Cost per day (avg)"
              value={usd(costPerDay)}
              sub={
                <SplitSub
                  sub={coverageDays < weekDays ? `over ${coverageDays} days with history` : `over ${weekDays} days`}
                  split={platformSplitLabel(bs, 'cost', usd, 1 / coverageDays)}
                />
              }
              help={`Estimated equivalent API cost averaged over the selected window (total cost ÷ days). When your logs start inside the window (${
                platform === 'codex' ? 'a new install' : "a new install, or Claude Code's ~30-day transcript cleanup"
              }), it divides by the days that have history instead.`}
            />
            <StatCard
              label="Projected this month"
              value={usd(projectedMonthCost)}
              sub={
                <SplitSub
                  sub={`${daysLeftInMonth}d left in month`}
                  split={platformSplitLabel(bs, 'cost', usd, daysThisMonth / coverageDays)}
                />
              }
              accent="#6366f1"
              help="Estimated month-end equivalent cost if your current average daily spend continues for the rest of the calendar month."
            />
          </>
        )}
      </div>

      {/* Server-side figure beside the estimate: LiteLLM bill (Claude) and OpenAI's per-day count vs local rollouts (Codex) — both can show under Both. */}
      {showClaude && litellmAvailable && litellmSpend && (
        <LiteLlmActualBilled spend={litellmSpend} host={litellmHost} weekDays={weekDays} />
      )}
      {showCodexCompare && (
        <CodexDailyCompareChart
          server={codexProfileOk ? (codexProfile.data?.dailyUsage ?? []) : []}
          local={codexUtcActivity.data?.dailyActivity ?? []}
          loading={codexProfile.loading || codexUtcActivity.loading}
          days={weekDays}
        />
      )}

      {splitSegments && splitSegments.length > 0 && (
        <SourcesSplitChart segments={splitSegments} weekDays={weekDays} help={sourcesHelp(platform)} scope={scope} />
      )}

      {/* Claude vs Codex, side by side — the one chart that exists only under Both. */}
      {bothActive && (
        <PlatformDailyCompareChart
          claude={claudeWeekly.data}
          codex={codexWeekly.data}
          loading={claudeWeekly.loading || codexWeekly.loading}
          weekDays={weekDays}
          metric={dailyMetric}
          onMetricChange={setDailyMetric}
        />
      )}

      {/* Effective tokens throughout (bars, projection, delta, export); totals only in the tooltip. */}
      <DailyTrendChart
        data={weekly.data}
        loading={weekly.loading}
        weekDays={weekDays}
        metric={dailyMetric}
        onMetricChange={setDailyMetric}
        costPerDay={costPerDay}
        tokensPerDay={(weekly.data?.totals.effectiveTokens ?? 0) / coverageDays}
        ai={aiProps('trends', aiTrendsPayload(weekly.data))}
        scope={scope}
      />

      {/* Cache efficiency chart */}
      {hasCacheData && (
        <Section title={`Cache efficiency${scope} · hit rate over time`} help={cacheEfficiencyHelp(platform)}>
          {cacheSeries ? (
            <CacheEfficiencyChart series={cacheSeries} />
          ) : (
            <CacheEfficiencyChart data={weekly.data?.cacheEfficiency ?? []} />
          )}
        </Section>
      )}

      {/* Peak hours heatmap */}
      <Section
        title={`Peak usage${scope} · tokens by hour & day of week`}
        help={`Effective tokens summed into a 7-day × 24-hour grid (your local time). Darker cells are your busiest hours — when you use ${noun} most.`}
      >
        {heatmap.data ? (
          <PeakHoursHeatmap grid={heatmap.data.grid} weekStart={weekStart} />
        ) : heatmap.loading ? (
          <HeatmapSkeleton />
        ) : (
          <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">No data</div>
        )}
      </Section>

      {/* Lifetime summary of the heatmap below — the same four cards everywhere. */}
      <ActivitySummary
        summary={summary.data}
        loading={summary.loading}
        platform={platform}
        codexServerLifetime={codexProfileOk ? codexProfile.data?.lifetimeTokens : null}
        scope={scope}
      />

      {/* Activity heatmap */}
      <Section
        title={`Daily activity${scope} · last 18 weeks`}
        help={`GitHub-style calendar: one square per day, darker = more effective tokens used. Shows your day-to-day ${noun} usage streaks over the last ~18 weeks.`}
      >
        {activity.data ? (
          <ActivityHeatmap days={activity.data.dailyActivity} weekStart={weekStart} />
        ) : activity.loading ? (
          <HeatmapSkeleton />
        ) : null}
      </Section>
    </>
  );
}
