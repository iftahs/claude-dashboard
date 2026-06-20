import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePolling } from './hooks/usePolling';
import { useLimits } from './hooks/useLimits';
import { useSettings } from './hooks/useSettings';
import type { ActivityData, ModelsData, RecentData, WeeklyData, ToolsData, ClaudeConfig, SessionMeta, LiveUsageData, HeatmapData, ProjectData, InsightsErrors, InsightsRetries, InsightsLanguages, InsightsBranches, InsightsMcp, ComplexityPoint, InsightsYield, InsightsRejections, SubagentStats, LiveSubagents, VersionInfo, SourcesInfo, UsageSource } from './types';
import { StatCard } from './components/design-system/atoms/StatCard/StatCard';
import { BlockGauge } from './components/design-system/organisms/BlockGauge/BlockGauge';
import { UsageBarChart } from './components/design-system/organisms/UsageBarChart/UsageBarChart';
import { ModelBreakdown } from './components/design-system/organisms/ModelBreakdown/ModelBreakdown';
import { ActivityHeatmap } from './components/design-system/organisms/ActivityHeatmap/ActivityHeatmap';
import { PeakHoursHeatmap } from './components/design-system/organisms/PeakHoursHeatmap/PeakHoursHeatmap';
import { CacheEfficiencyChart } from './components/design-system/organisms/CacheEfficiencyChart/CacheEfficiencyChart';
import { ToolUsage } from './components/design-system/organisms/ToolUsage/ToolUsage';
import { LiveBadge } from './components/design-system/atoms/LiveBadge/LiveBadge';
import { SettingsModal } from './components/design-system/molecules/SettingsModal/SettingsModal';
import { ApiModeNote } from './components/design-system/molecules/ApiModeNote/ApiModeNote';
import { CostCalculation } from './components/design-system/organisms/CostCalculation/CostCalculation';
import { ConfigProfile } from './components/design-system/organisms/ConfigProfile/ConfigProfile';
import { PlanUsage } from './components/design-system/molecules/PlanUsage/PlanUsage';
import { ProjectBreakdown } from './components/design-system/organisms/ProjectBreakdown/ProjectBreakdown';
import { SessionHistoryTable } from './components/design-system/organisms/SessionHistoryTable/SessionHistoryTable';
import { ExportButton } from './components/design-system/molecules/ExportButton/ExportButton';
import { Section } from './components/design-system/molecules/Section/Section';
import { OfflineBanner } from './components/design-system/molecules/OfflineBanner/OfflineBanner';
import { UpdateBanner } from './components/design-system/molecules/UpdateBanner/UpdateBanner';
import { SpendingLimits } from './components/design-system/molecules/SpendingLimits/SpendingLimits';
import { ToggleGroup } from './components/design-system/atoms/ToggleGroup/ToggleGroup';
import { LegendDot } from './components/design-system/atoms/LegendDot/LegendDot';
import { ErrorBreakdown } from './components/design-system/organisms/ErrorBreakdown/ErrorBreakdown';
import { LanguageBreakdown } from './components/design-system/organisms/LanguageBreakdown/LanguageBreakdown';
import { BranchBreakdown } from './components/design-system/organisms/BranchBreakdown/BranchBreakdown';
import { McpBreakdown } from './components/design-system/organisms/McpBreakdown/McpBreakdown';
import { ComplexityScatter } from './components/design-system/organisms/ComplexityScatter/ComplexityScatter';
import { YieldPanel } from './components/design-system/organisms/YieldPanel/YieldPanel';
import { RetryPanel } from './components/design-system/organisms/RetryPanel/RetryPanel';
import { RejectionsPanel } from './components/design-system/organisms/RejectionsPanel/RejectionsPanel';
import { SubagentStatsPanel } from './components/design-system/organisms/SubagentStatsPanel/SubagentStatsPanel';
import { AgentActivity } from './components/design-system/organisms/AgentActivity/AgentActivity';
import {
  StatCardSkeleton,
  ChartSkeleton,
  GaugeSkeleton,
  DonutSkeleton,
  BarsSkeleton,
  HeatmapSkeleton,
  Skeleton,
} from './components/design-system/atoms/Skeleton/Skeleton';
import { compact, usd, hourLabel, dayLabel, shortModel } from './lib/format';
import { track, setUserContext, isOptedOut, setOptOut } from './lib/analytics';

const POLL = 5000;

type Tab = 'live' | 'agents' | 'trends' | 'models' | 'insights' | 'sessions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: '⚡ Live Usage' },
  { id: 'agents', label: '🤖 Agents · Live Activity' },
  { id: 'trends', label: '📈 Trends' },
  { id: 'models', label: '🧠 Models' },
  { id: 'insights', label: '🔍 Insights' },
  { id: 'sessions', label: '📋 Sessions' },
];

type InsightDays = '7' | '14' | '30';
const INSIGHT_DAY_OPTIONS: { value: InsightDays; label: string }[] = [
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
];

// Source filter (Code = Claude Code CLI, Cowork = desktop local-agent mode).
// Only surfaced when the user actually has Cowork data on disk.
type SourceFilter = 'all' | UsageSource;
const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'code', label: 'Code' },
  { value: 'cowork', label: 'Cowork' },
];
const SOURCE_COLOR: Record<UsageSource, string> = { code: '#d97757', cowork: '#6366f1' };

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const seg = location.pathname.replace(/^\//, '');
  const activeTab: Tab = TABS.some((t) => t.id === seg) ? (seg as Tab) : 'live';
  const [weekDays, setWeekDays] = useState(7);
  const [recentHours, setRecentHours] = useState(12);
  const [dailyMetric, setDailyMetric] = useState<'tokens' | 'cost'>('tokens');

  // Cowork detection — fetched first; gates every Cowork affordance below so that
  // Code-only users get the original dashboard byte-for-byte.
  const sourcesInfo = usePolling<SourcesInfo>('/api/sources', 60000);
  const coworkAvailable = !!sourcesInfo.data?.cowork.available;
  const [source, setSource] = useState<SourceFilter>('all');
  // If Cowork data disappears (or never existed), never leave a stale scoped filter.
  useEffect(() => {
    if (!coworkAvailable && source !== 'all') setSource('all');
  }, [coworkAvailable, source]);
  // Append ?source= only when Cowork data exists and a surface is selected; otherwise
  // the URL is identical to before this feature (no refetch churn, no behavior change).
  const withSrc = (url: string) =>
    coworkAvailable && source !== 'all'
      ? url + (url.includes('?') ? '&' : '?') + `source=${source}`
      : url;

  const recent = usePolling<RecentData>(withSrc(`/api/usage/recent?hours=${recentHours}`), POLL);
  const weekly = usePolling<WeeklyData>(withSrc(`/api/usage/weekly?days=${weekDays}`), POLL);
  const models = usePolling<ModelsData>(withSrc('/api/usage/models?days=7'), POLL);
  const activity = usePolling<ActivityData>(withSrc('/api/activity'), 30000);
  const tools = usePolling<ToolsData>(withSrc('/api/tools?days=7'), 30000);
  const config = usePolling<ClaudeConfig>('/api/config', 60000);
  const sessions = usePolling<SessionMeta[]>(withSrc('/api/sessions'), 10000);
  const liveUsage = usePolling<LiveUsageData>('/api/usage/live', 15000);
  const heatmap = usePolling<HeatmapData>(withSrc('/api/heatmap?days=90'), 60000);
  const projectCosts = usePolling<ProjectData>(withSrc('/api/projects?days=90'), 30000);
  const liveSubagents = usePolling<LiveSubagents>('/api/subagents/live', 4000);
  const version = usePolling<VersionInfo>('/api/version', 1_800_000);
  const [limits, setLimits] = useLimits();
  const [settings, setSettings] = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsOptOut, setAnalyticsOptOut] = useState(isOptedOut());

  // Auth mode — auto-detected by the backend (presence of a Claude.ai OAuth token),
  // with an optional manual override from the Settings modal. API / pay-as-you-go
  // mode swaps the subscription-rate-limit framing for a cost view. Default to
  // subscription until config loads so the UI never flashes API mode for subscribers.
  const detectedMode: 'api' | 'subscription' = config.data?.authMode ?? 'subscription';
  const effectiveMode =
    settings.modeOverride === 'auto' ? detectedMode : settings.modeOverride;
  const isApi = effectiveMode === 'api';

  // Insights tab state
  const [insightDays, setInsightDays] = useState<InsightDays>('7');
  const insightDaysNum = insightDays;

  // ── Product analytics (anonymous, path-free events only — see lib/analytics) ──
  useEffect(() => {
    track('tab_viewed', { tab: activeTab });
  }, [activeTab]);
  useEffect(() => {
    if (config.data) setUserContext({ plan: config.data.subscriptionType, usageMode: effectiveMode });
  }, [config.data, effectiveMode]);
  const insightErrors = usePolling<InsightsErrors>(withSrc(`/api/insights/errors?days=${insightDaysNum}`), 60000);
  const insightRetries = usePolling<InsightsRetries>(withSrc(`/api/insights/retries?days=${insightDaysNum}`), 60000);
  const insightLanguages = usePolling<InsightsLanguages[]>(withSrc(`/api/insights/languages?days=${insightDaysNum}`), 60000);
  const insightBranches = usePolling<InsightsBranches[]>(withSrc(`/api/insights/branches?days=${insightDaysNum}`), 60000);
  const insightMcp = usePolling<InsightsMcp>(withSrc(`/api/insights/mcp?days=${insightDaysNum}`), 60000);
  const insightComplexity = usePolling<ComplexityPoint[]>(withSrc(`/api/insights/complexity?days=${insightDaysNum}`), 60000);
  const insightYield = usePolling<InsightsYield>(withSrc(`/api/insights/yield?days=${insightDaysNum}`), 60000);
  const insightRejections = usePolling<InsightsRejections>(withSrc(`/api/insights/rejections?days=${insightDaysNum}`), 60000);
  const insightSubagents = usePolling<SubagentStats>(withSrc(`/api/insights/subagents?days=${insightDaysNum}`), 60000);

  const error = recent.error || weekly.error;
  const empty =
    !recent.loading &&
    !weekly.loading &&
    (recent.data?.totals.totalTokens ?? 0) === 0 &&
    (weekly.data?.totals.totalTokens ?? 0) === 0;

  const block = recent.data?.activeBlock ?? null;
  const topModel = models.data?.models[0];
  const weeklyEffective = weekly.data?.totals.effectiveTokens ?? 0;
  const prevWeeklyEffective = weekly.data?.prevTotals.effectiveTokens ?? 0;

  // Normalize to cost per day from whatever range is selected
  const costPerDay = (weekly.data?.totals.cost ?? 0) / weekDays;
  const hasSpendingLimits =
    limits.dailyLimit != null || limits.weeklyLimit != null || limits.monthlyLimit != null;

  // F3: Projected month-end cost
  const now = new Date();
  const daysLeftInMonth =
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const projectedMonthCost = costPerDay * (now.getDate() + daysLeftInMonth);

  const totalPeriodDays = useMemo(() => {
    if (!sessions.data || sessions.data.length === 0) return 0;
    const timestamps = sessions.data
      .map((s) => Date.parse(s.start_time))
      .filter((t) => !isNaN(t));
    if (timestamps.length === 0) return 0;
    const oldest = Math.min(...timestamps);
    const diffMs = Date.now() - oldest;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }, [sessions.data]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100">Claude Usage</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {recent.claudeDir ? (
              <span className="font-mono text-xs">{recent.claudeDir}</span>
            ) : (
              'local logs'
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {coworkAvailable && (
            <div className="flex items-center gap-2" title="Filter usage by surface: Claude Code CLI vs Cowork (desktop local-agent mode)">
              <span className="text-[11px] uppercase tracking-wide text-zinc-600">source</span>
              <ToggleGroup<SourceFilter>
                options={SOURCE_OPTIONS}
                value={source}
                onChange={(s) => {
                  setSource(s);
                  track('source_changed', { source: s });
                }}
              />
            </div>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-base text-zinc-400 ring-1 ring-white/10 hover:text-zinc-200 hover:ring-white/20"
            title="Settings — usage mode & spending limits"
            aria-label="Settings"
          >
            ⚙
          </button>
          <LiveBadge computedAt={recent.computedAt} error={error} />
        </div>
      </header>

      {showSettings && (
        <SettingsModal
          limits={limits}
          onChangeLimits={setLimits}
          settings={settings}
          onChangeSettings={setSettings}
          detectedMode={detectedMode}
          analyticsOptOut={analyticsOptOut}
          onChangeAnalyticsOptOut={(v) => {
            setOptOut(v);
            setAnalyticsOptOut(v);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* New-version notice (all tabs) */}
      <UpdateBanner data={version.data} />

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl bg-ink-800/60 p-1 ring-1 ring-white/5">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => navigate(`/${id}`)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              activeTab === id
                ? 'bg-ink-700 text-zinc-100 shadow-sm ring-1 ring-white/10'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-ink-700/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {empty ? (
        <div className="card mt-6 p-12 text-center text-zinc-400">
          No usage logs found. Use Claude Code, then this dashboard will populate.
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── LIVE TAB ── */}
          {activeTab === 'live' && (
            <>
              {/* Auth-mode notice: a neutral pay-as-you-go note for API users,
                  the subscription session/offline banner otherwise. */}
          {isApi ? (
            <ApiModeNote />
          ) : (
            liveUsage.data?.error && <OfflineBanner error={liveUsage.data.error} />
          )}

          {/* Block gauge + hourly chart */}
              <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
                {recent.loading ? (
                  <GaugeSkeleton />
                ) : (
                  <BlockGauge
                    block={block}
                    liveUsage={liveUsage.data}
                    isApi={isApi}
                    costPerDay={costPerDay}
                    dailyLimit={limits.dailyLimit}
                  />
                )}
                <div className="flex flex-col lg:col-span-2">
                  <Section
                    title={`Last ${recentHours} hours · hourly tokens by model`}
                    help="Tokens used per hour over the recent window, stacked by model. Use the buttons on the right to change the window (5–48h)."
                    right={
                      <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10">
                        {[5, 12, 24, 48].map((h) => (
                          <button
                            key={h}
                            onClick={() => setRecentHours(h)}
                            className={`px-2.5 py-1 text-xs tabular-nums transition-colors ${
                              recentHours === h
                                ? 'bg-clay-500/20 text-clay-400'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {h}h
                          </button>
                        ))}
                      </div>
                    }
                    grow
                  >
                    {recent.data ? (
                      <UsageBarChart buckets={recent.data.buckets} labelFor={hourLabel} />
                    ) : recent.loading ? (
                      <ChartSkeleton />
                    ) : null}
                  </Section>
                </div>
              </div>

              {/* Subscription rate-limit bars — only meaningful with a plan. */}
              {config.data && !isApi && (
                <PlanUsage block={block} weekly={weekly.data} liveUsage={liveUsage.data} />
              )}

              {/* Spend vs caps — always shown in API mode (the cost IS the bill);
                  in subscription mode only when the user has configured caps. */}
              {(isApi || hasSpendingLimits) && (
                <SpendingLimits
                  limits={limits}
                  costPerDay={costPerDay}
                  weekCost={weekly.data?.totals.cost}
                  alwaysShow={isApi}
                />
              )}
            </>
          )}

          {/* ── AGENTS TAB ── */}
          {activeTab === 'agents' && (
            <AgentActivity data={liveSubagents.data} loading={liveSubagents.loading} />
          )}

          {/* ── TRENDS TAB ── */}
          {activeTab === 'trends' && (
            <>
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
                      sub={topModel ? `top: ${shortModel(topModel.model)}` : undefined}
                      help="What this usage would cost at Anthropic's pay-as-you-go API rates. Your subscription has no per-token bill — this is a reference figure only."
                    />
                    <StatCard
                      label={`Effective tokens · last ${weekDays} days`}
                      value={compact(weeklyEffective)}
                      sub={
                        prevWeeklyEffective > 0
                          ? `${weekDays === 7 ? 'prev week' : `prev ${weekDays / 7} weeks`}: ${compact(prevWeeklyEffective)}`
                          : `${compact(weekly.data?.totals.outputTokens ?? 0)} output`
                      }
                      help="Input + output + cache-write tokens — the tokens that count toward rate limits. Cheap cache reads are excluded. Compared against the previous period."
                    />
                    <StatCard
                      label="Cost per day (avg)"
                      value={usd(costPerDay)}
                      sub={`over ${weekDays} days`}
                      help="Estimated equivalent API cost averaged over the selected window (total cost ÷ days)."
                    />
                    <StatCard
                      label="Projected this month"
                      value={usd(projectedMonthCost)}
                      sub={`${daysLeftInMonth}d left in month`}
                      accent="#6366f1"
                      help="Estimated month-end equivalent cost if your current average daily spend continues for the rest of the calendar month."
                    />
                  </>
                )}
              </div>

              {/* Sources split (Code vs Cowork) — only under the All filter, where
                  the split is meaningful (a single-surface filter zeroes the other). */}
              {coworkAvailable && source === 'all' && weekly.data?.bySource && (() => {
                const bs = weekly.data.bySource;
                const codeEff = bs.code.effectiveTokens;
                const coworkEff = bs.cowork.effectiveTokens;
                const total = codeEff + coworkEff;
                const codePct = total > 0 ? (codeEff / total) * 100 : 0;
                return (
                  <Section
                    title={`Sources · effective tokens · ${weekDays}d`}
                    help="Split of effective tokens (and equivalent cost) between Claude Code (CLI) and Cowork (desktop local-agent mode) over the selected window."
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-1 h-3 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/5">
                        <div style={{ width: `${codePct}%`, backgroundColor: SOURCE_COLOR.code }} />
                        <div style={{ width: `${100 - codePct}%`, backgroundColor: SOURCE_COLOR.cowork }} />
                      </div>
                      <div className="flex items-center gap-4">
                        <LegendDot color={SOURCE_COLOR.code} label={`Code · ${compact(codeEff)} · ${usd(bs.code.cost)}`} />
                        <LegendDot color={SOURCE_COLOR.cowork} label={`Cowork · ${compact(coworkEff)} · ${usd(bs.cowork.cost)}`} />
                      </div>
                    </div>
                  </Section>
                );
              })()}

              {/* Daily chart with projection */}
              {(() => {
                const currentVal = dailyMetric === 'cost' ? (weekly.data?.totals.cost ?? 0) : weeklyEffective;
                const prevVal = dailyMetric === 'cost' ? (weekly.data?.prevTotals.cost ?? 0) : prevWeeklyEffective;
                const delta =
                  prevVal > 0
                    ? Math.round(
                        ((currentVal - prevVal) / prevVal) * 100
                      )
                    : null;
                return (
                  <Section
                    title={`Last ${weekDays} days · daily ${dailyMetric} by model`}
                    help="Daily tokens (or equivalent cost), stacked by model. The dotted segment past today is a projection from your recent daily average. Toggle tokens/cost and the window on the right."
                    right={
                      <div className="flex items-center gap-3">
                        {delta !== null && (
                          <span
                            className={`text-xs font-semibold ${delta >= 0 ? 'text-red-400' : 'text-emerald-400'}`}
                          >
                            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs prev period
                          </span>
                        )}
                        <ExportButton
                          label="Export"
                          getData={() => {
                            if (!weekly.data) return null;
                            const csv = weekly.data.buckets.map((b) => ({
                              date: dayLabel(b.start),
                              effectiveTokens: b.effectiveTokens,
                              cost: b.cost.toFixed(4),
                              ...b.byModel,
                            }));
                            return { csv, json: weekly.data.buckets, filename: `trends-${weekDays}d` };
                          }}
                        />
                        {/* Metric Selector */}
                        <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10 text-xs">
                          {(['tokens', 'cost'] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => setDailyMetric(m)}
                              className={`px-2.5 py-1 uppercase font-semibold transition-colors ${
                                dailyMetric === m
                                  ? 'bg-clay-500/20 text-clay-400'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                        <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10">
                          {[7, 14, 21, 28].map((d) => (
                            <button
                              key={d}
                              onClick={() => setWeekDays(d)}
                              className={`px-2.5 py-1 text-xs tabular-nums transition-colors ${
                                weekDays === d
                                  ? 'bg-clay-500/20 text-clay-400'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {d / 7}w
                            </button>
                          ))}
                        </div>
                      </div>
                    }
                  >
                    {weekly.data ? (
                      <UsageBarChart
                        buckets={weekly.data.buckets}
                        labelFor={dayLabel}
                        projectionCostPerDay={costPerDay}
                        metric={dailyMetric}
                      />
                    ) : weekly.loading ? (
                      <ChartSkeleton />
                    ) : null}
                  </Section>
                );
              })()}

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
                help="Effective tokens summed into a 7-day × 24-hour grid (your local time). Darker cells are your busiest hours — when you use Claude most."
              >
                {heatmap.data ? (
                  <PeakHoursHeatmap grid={heatmap.data.grid} />
                ) : heatmap.loading ? (
                  <HeatmapSkeleton />
                ) : (
                  <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">No data</div>
                )}
              </Section>

              {/* Activity heatmap */}
              <Section
                title="Daily activity · last 18 weeks"
                help="GitHub-style calendar: one square per day, darker = more effective tokens used. Shows your day-to-day usage streaks over the last ~18 weeks."
              >
                {activity.data ? (
                  <ActivityHeatmap days={activity.data.dailyActivity} />
                ) : activity.loading ? (
                  <HeatmapSkeleton />
                ) : null}
              </Section>
            </>
          )}

          {/* ── MODELS TAB ── */}
          {activeTab === 'models' && (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Section
                  title="Model breakdown · 7d"
                  help="Share of effective tokens by model over the last 7 days, with each model's cost per 1M effective tokens. Shows which models your usage leans on."
                >
                  {models.data ? (
                    <ModelBreakdown models={models.data.models} />
                  ) : models.loading ? (
                    <DonutSkeleton />
                  ) : null}
                </Section>
                <Section
                  title="Tool usage · 7d"
                  help="How many times each tool was invoked over the last 7 days, ranked. Reflects which tools the work relied on most."
                >
                  {tools.data ? (
                    <ToolUsage tools={tools.data.tools} totalCalls={tools.data.totalCalls} />
                  ) : tools.loading ? (
                    <BarsSkeleton />
                  ) : null}
                </Section>
              </div>
              <CostCalculation />
            </>
          )}

          {/* ── INSIGHTS TAB ── */}
          {activeTab === 'insights' && (
            <>
              {/* Header row: day selector */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-500">Behavior analytics for the selected window</div>
                <ToggleGroup<InsightDays>
                  options={INSIGHT_DAY_OPTIONS}
                  value={insightDays}
                  onChange={(d) => {
                    setInsightDays(d);
                    track('insight_range_changed', { days: d });
                  }}
                />
              </div>

              {/* Top stat cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  label="Error rate"
                  value={
                    insightErrors.data
                      ? `${(insightErrors.data.errorRate * 100).toFixed(1)}%`
                      : '—'
                  }
                  sub={
                    insightErrors.data
                      ? `${insightErrors.data.errors} errors / ${insightErrors.data.totalCalls} calls`
                      : 'loading…'
                  }
                  accent="#f87171"
                  help="Share of tool calls in this window that failed or were rejected (error result returned). Lower is better."
                />
                <StatCard
                  label="One-shot rate"
                  value={
                    insightRetries.data
                      ? `${(insightRetries.data.oneShotRate * 100).toFixed(1)}%`
                      : '—'
                  }
                  sub={
                    insightRetries.data
                      ? `${insightRetries.data.retried} retried edits`
                      : 'loading…'
                  }
                  help="Share of Edit/Write calls that succeeded on the first try (no follow-up retry on the same file). Higher means cleaner edits."
                />
                <StatCard
                  label="Delegation rate"
                  value={
                    insightSubagents.data
                      ? `${(insightSubagents.data.delegationRate * 100).toFixed(0)}%`
                      : '—'
                  }
                  sub={
                    insightSubagents.data
                      ? `${insightSubagents.data.spawns} subagent spawns`
                      : 'loading…'
                  }
                  help="Share of sessions that spawned at least one subagent (Task/Agent tool). Indicates how often work is delegated to subagents."
                />
                <StatCard
                  label="Wasted tokens"
                  value={
                    insightRetries.data
                      ? compact(insightRetries.data.wastedTokens)
                      : '—'
                  }
                  sub={
                    insightRetries.data
                      ? `est. ${usd(insightRetries.data.wastedCost)} wasted`
                      : 'loading…'
                  }
                  accent="#f59e0b"
                  help="Estimated tokens spent on edits that errored and had to be retried — approximated from each session's average tokens-per-turn. A rough waste indicator."
                />
              </div>

              {/* Tool errors — full width */}
              <Section
                title="Tool errors · failure analysis"
                help="Failed/rejected tool calls in this window, grouped by error category (left) and by tool (right). The line shows errors per day. Percentages are each tool's own error rate."
              >
                <ErrorBreakdown data={insightErrors.data} />
              </Section>

              {/* Languages | Branches */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Section
                  title="Languages · edits by file type"
                  help="Files touched in this window, bucketed by extension into a language. Solid = edits/writes; dimmed = reads. Shows what kinds of files the work concentrated on."
                >
                  <LanguageBreakdown data={insightLanguages.data} />
                </Section>
                <Section
                  title="Branches · token usage by git branch"
                  help="Effective tokens, cost and session count attributed to each git branch (shown as repo / branch). Reflects which branches the most work went into."
                >
                  <BranchBreakdown data={insightBranches.data} />
                </Section>
              </div>

              {/* MCP | Rejections */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Section
                  title="MCP vs built-in · tool call split"
                  help="How tool calls split between Claude's built-in tools and tools from connected MCP servers. The per-server table lists call counts and how many failed (errors), one row per MCP server."
                >
                  <McpBreakdown data={insightMcp.data} />
                </Section>
                <Section
                  title="Permission rejections · by tool"
                  help="Tool calls you declined when Claude asked for permission, grouped by tool. High counts flag tools Claude reaches for that you often block."
                >
                  <RejectionsPanel data={insightRejections.data} />
                </Section>
              </div>

              {/* Complexity scatter — full width */}
              <Section
                title="Session complexity · tool calls vs tokens (dot size = subagents)"
                help="One dot per session: x = number of tool calls, y = effective tokens, dot size = subagents spawned. Dots to the upper-right are the heaviest, most complex sessions."
              >
                <ComplexityScatter data={insightComplexity.data} />
              </Section>

              {/* Yield | Subagent stats */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Section
                  title="Yield · committed vs uncommitted sessions"
                  help="Sessions that ran a git commit vs those that didn't — a rough proxy for which work landed. Lists the biggest uncommitted sessions by tokens."
                >
                  <YieldPanel data={insightYield.data} />
                </Section>
                <Section
                  title="Subagent stats · delegation analysis"
                  help="Subagent (Task/Agent) spawns in this window: total, average per delegating session, and breakdowns by subagent type and model."
                >
                  <SubagentStatsPanel data={insightSubagents.data} />
                </Section>
              </div>

              {/* Retry panel — standalone */}
              <Section
                title="Edit retries · one-shot analysis"
                help="Edit/Write calls that succeeded first try vs those retried after an error, with the estimated tokens and cost wasted on the retries."
              >
                <RetryPanel data={insightRetries.data} />
              </Section>
            </>
          )}

          {/* ── SESSIONS TAB ── */}
          {activeTab === 'sessions' && (
            <>
              {/* Config profile + per-project breakdown only make sense for Code.
                  Cowork sessions run in a sandbox with no host project, so under
                  the Cowork filter we skip straight to the session log. */}
              {source !== 'cowork' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-1 self-start">
                    {config.data ? (
                      <ConfigProfile config={config.data} isApi={isApi} />
                    ) : config.loading ? (
                      <div className="card p-5">
                        <Skeleton className="h-[200px] w-full rounded-2xl" />
                      </div>
                    ) : null}
                  </div>
                  <div className="lg:col-span-2">
                    {sessions.data ? (
                      <ProjectBreakdown
                        sessions={sessions.data}
                        periodDays={totalPeriodDays}
                        projectCosts={projectCosts.data?.projects}
                      />
                    ) : sessions.loading ? (
                      <div className="card p-5">
                        <Skeleton className="h-[200px] w-full rounded-2xl" />
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {sessions.data ? (
                <SessionHistoryTable
                  sessions={sessions.data}
                  periodDays={totalPeriodDays}
                  onExport={() => sessions.data ?? []}
                />
              ) : sessions.loading ? (
                <div className="card p-5 space-y-3">
                  <Skeleton className="h-5 w-48 rounded" />
                  <Skeleton className="h-3 w-72 rounded" />
                  <Skeleton className="mt-2 h-[280px] w-full rounded-2xl" />
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* Footer credits */}
      <footer className="mt-10 border-t border-white/5 pt-6 pb-2 text-center text-xs text-zinc-600">
        <p>
          Built by{' '}
          <a
            href="https://iftah.dev"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-zinc-400 transition-colors hover:text-clay-400"
          >
            Iftah Saar
          </a>
          {version.data?.current && (
            <span className="text-zinc-700"> · v{version.data.current}</span>
          )}
          {version.data?.repoUrl && (
            <>
              {' · '}
              <a
                href={version.data.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-zinc-400"
              >
                GitHub
              </a>
            </>
          )}
        </p>
      </footer>
    </div>
  );
}
