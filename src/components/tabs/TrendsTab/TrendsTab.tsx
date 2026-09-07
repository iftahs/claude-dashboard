import { useState } from 'react';
import { StatCard } from '@/components/design-system/atoms/StatCard/StatCard';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { ExportButton } from '@/components/design-system/molecules/ExportButton/ExportButton';
import { CacheEfficiencyChart } from '@/components/design-system/organisms/CacheEfficiencyChart/CacheEfficiencyChart';
import { PeakHoursHeatmap } from '@/components/design-system/organisms/PeakHoursHeatmap/PeakHoursHeatmap';
import { ActivityHeatmap } from '@/components/design-system/organisms/ActivityHeatmap/ActivityHeatmap';
import { LiteLlmActualBilled } from '@/components/design-system/organisms/LiteLlmActualBilled/LiteLlmActualBilled';
import { SourcesSplitChart } from '@/components/design-system/organisms/SourcesSplitChart/SourcesSplitChart';
import { PlatformDailyCompareChart } from '@/components/design-system/organisms/PlatformDailyCompareChart/PlatformDailyCompareChart';
import { DailyTrendChart } from '@/components/design-system/organisms/DailyTrendChart/DailyTrendChart';
import type { DailyMetric } from '@/components/design-system/organisms/DailyTrendChart/types';
import { StatCardSkeleton, HeatmapSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact, usd, shortModel } from '@/lib/format';
import { buildSpendReport } from '@/lib/report';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { useConfigMode } from '@/hooks/useConfigMode';
import { useLiveData } from '@/hooks/useLiveData';
import { useCostMetrics } from '@/hooks/useCostMetrics';
import { useLiteLlmActual } from '@/hooks/useLiteLlmActual';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import type { ActivityData, HeatmapData, WeeklyData } from '@/types';
import { PLATFORM_NOUN, costBasisHelp, platformSplitLabel } from './utils';

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

export function TrendsTab() {
  const { platform, showClaude, showSurfaceToggle, source, withSrc, effectiveSource } = useSource();
  const { litellmAvailable, litellmHost, weekStart } = useConfigMode();
  const { weekly, models, weekDays, setWeekDays } = useLiveData();
  const { costPerDay, daysLeftInMonth, projectedMonthCost, weeklyEffective, prevWeeklyEffective } =
    useCostMetrics();
  const { litellmSpend } = useLiteLlmActual();
  const { aiProps } = useAiInsightCtx();
  const [dailyMetric, setDailyMetric] = useState<DailyMetric>('tokens');

  const heatmap = usePolling<HeatmapData>(withSrc('/api/heatmap?days=90'), 60000);
  const activity = usePolling<ActivityData>(withSrc('/api/activity'), 30000);
  const topModel = models.data?.models[0];
  const noun = PLATFORM_NOUN[platform];

  // Under *Both* the shared weekly poll is deliberately unscoped, so the
  // comparison needs its own two explicitly-scoped polls. An empty URL issues no
  // request, so nothing extra is fetched on any other platform.
  const bothActive = platform === 'both';
  const claudeWeekly = usePolling<WeeklyData>(
    bothActive ? `/api/usage/weekly?days=${weekDays}&source=claude` : '',
    5000,
  );
  const codexWeekly = usePolling<WeeklyData>(
    bothActive ? `/api/usage/weekly?days=${weekDays}&source=codex` : '',
    5000,
  );

  // Sub-labels splitting each card between the two platforms — only under Both,
  // where the card total is a sum. On a single platform it already IS that one.
  const bs = bothActive ? weekly.data?.bySource : undefined;
  const daysThisMonth = new Date().getDate() + daysLeftInMonth;

  return (
    <>
      {/* Window selector — drives the cost stat cards, the estimate chart,
          and (when present) the LiteLLM actual-billed chart. */}
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-zinc-500">Spending · last {weekDays} days</span>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10">
            {[7, 14, 21, 28].map((d) => (
              <button
                key={d}
                onClick={() => setWeekDays(d)}
                className={`px-2.5 py-1 text-xs tabular-nums transition-colors ${
                  weekDays === d ? 'bg-clay-500/20 text-clay-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {d / 7}w
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
                  sub={topModel ? `top: ${shortModel(topModel.model)}` : ''}
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
                      ? `${weekDays === 7 ? 'prev week' : `prev ${weekDays / 7} weeks`}: ${compact(prevWeeklyEffective)}`
                      : `${compact(weekly.data?.totals.outputTokens ?? 0)} output`
                  }
                  split={platformSplitLabel(bs, 'effectiveTokens', compact)}
                />
              }
              help="Input + output + cache-write tokens — the tokens that count toward rate limits. Cheap cache reads are excluded. Compared against the previous period."
            />
            <StatCard
              label="Cost per day (avg)"
              value={usd(costPerDay)}
              sub={
                <SplitSub
                  sub={`over ${weekDays} days`}
                  split={platformSplitLabel(bs, 'cost', usd, 1 / weekDays)}
                />
              }
              help="Estimated equivalent API cost averaged over the selected window (total cost ÷ days)."
            />
            <StatCard
              label="Projected this month"
              value={usd(projectedMonthCost)}
              sub={
                <SplitSub
                  sub={`${daysLeftInMonth}d left in month`}
                  split={platformSplitLabel(bs, 'cost', usd, daysThisMonth / weekDays)}
                />
              }
              accent="#6366f1"
              help="Estimated month-end equivalent cost if your current average daily spend continues for the rest of the calendar month."
            />
          </>
        )}
      </div>

      {/* Actual billed (LiteLLM gateway): month-to-date + per-day window. The
          gateway proxies Anthropic, so it has nothing to say under Codex-only. */}
      {showClaude && litellmAvailable && litellmSpend && (
        <LiteLlmActualBilled spend={litellmSpend} host={litellmHost} weekDays={weekDays} />
      )}

      {/* Sources split — shown only where a split is meaningful: under Both
          (Claude Code / Cowork / Codex) or under the Claude platform's All filter
          (Code / Cowork). Codex-only has a single surface and hides it, and
          Code-only users reach neither branch. */}
      {(bothActive || (showSurfaceToggle && source === 'all')) && weekly.data?.bySource && (
        <SourcesSplitChart bySource={weekly.data.bySource} weekDays={weekDays} />
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

      {/* Daily chart with projection */}
      <DailyTrendChart
        data={weekly.data}
        loading={weekly.loading}
        weekDays={weekDays}
        metric={dailyMetric}
        onMetricChange={setDailyMetric}
        costPerDay={costPerDay}
        ai={aiProps('trends', weekly.data)}
      />

      {/* Cache efficiency chart */}
      {weekly.data?.cacheEfficiency && weekly.data.cacheEfficiency.length > 0 && (
        <Section
          title="Cache efficiency · hit rate over time"
          help="Share of total tokens served from the prompt cache each day (cache reads ÷ all tokens). Higher means more context was reused cheaply instead of re-sent."
        >
          <CacheEfficiencyChart data={weekly.data.cacheEfficiency} />
        </Section>
      )}

      {/* Peak hours heatmap */}
      <Section
        title="Peak usage · tokens by hour & day of week"
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

      {/* Activity heatmap */}
      <Section
        title="Daily activity · last 18 weeks"
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
