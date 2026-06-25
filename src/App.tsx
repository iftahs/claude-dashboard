import { useState, useMemo, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePolling } from './hooks/usePolling';
import { useLimits } from './hooks/useLimits';
import { useSource, SOURCE_OPTIONS, type SourceFilter } from './hooks/useSource';
import { useConfigMode } from './hooks/useConfigMode';
import { useLiveData } from './hooks/useLiveData';
import { useAiInsightCtx } from './hooks/useAiInsightContext';
import type { ActivityData, ToolsData, SessionMeta, HeatmapData, ProjectData, InsightsErrors, InsightsRetries, InsightsLanguages, InsightsBranches, InsightsMcp, ComplexityPoint, InsightsYield, InsightsRejections, SubagentStats, CommandUsageData, FileChurnData, WorkspaceTasksData, InventoryData, UsageSource } from './types';
import { StatCard } from './components/design-system/atoms/StatCard/StatCard';
import { BlockGauge } from './components/design-system/organisms/BlockGauge/BlockGauge';
import { UsageBarChart } from './components/design-system/organisms/UsageBarChart/UsageBarChart';
import { ModelBreakdown } from './components/design-system/organisms/ModelBreakdown/ModelBreakdown';
import { ActivityHeatmap } from './components/design-system/organisms/ActivityHeatmap/ActivityHeatmap';
import { PeakHoursHeatmap } from './components/design-system/organisms/PeakHoursHeatmap/PeakHoursHeatmap';
import { CacheEfficiencyChart } from './components/design-system/organisms/CacheEfficiencyChart/CacheEfficiencyChart';
import { ToolUsage } from './components/design-system/organisms/ToolUsage/ToolUsage';
import { LiveBadge } from './components/design-system/atoms/LiveBadge/LiveBadge';
import { SettingsView } from './components/design-system/organisms/SettingsView/SettingsView';
import { Sidebar } from './components/design-system/organisms/Sidebar/Sidebar';
import { CostCalculation } from './components/design-system/organisms/CostCalculation/CostCalculation';
import { ConfigProfile } from './components/design-system/organisms/ConfigProfile/ConfigProfile';
import { PlanUsage } from './components/design-system/molecules/PlanUsage/PlanUsage';
import { ProjectBreakdown } from './components/design-system/organisms/ProjectBreakdown/ProjectBreakdown';
import { SessionHistoryTable } from './components/design-system/organisms/SessionHistoryTable/SessionHistoryTable';
import { ExportButton } from './components/design-system/molecules/ExportButton/ExportButton';
import { Section } from './components/design-system/molecules/Section/Section';
import { SpendingLimits } from './components/design-system/molecules/SpendingLimits/SpendingLimits';
import { ToggleGroup } from './components/design-system/atoms/ToggleGroup/ToggleGroup';
import { LegendDot } from './components/design-system/atoms/LegendDot/LegendDot';
import { LiteLlmDailyChart } from './components/design-system/organisms/LiteLlmDailyChart/LiteLlmDailyChart';
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
import { WorkflowsView } from './components/design-system/organisms/WorkflowsView/WorkflowsView';
import { AiChat } from './components/design-system/organisms/AiChat/AiChat';
import { CommandUsage } from './components/design-system/organisms/CommandUsage/CommandUsage';
import { FileChurn } from './components/design-system/organisms/FileChurn/FileChurn';
import { TasksPanel } from './components/design-system/organisms/TasksPanel/TasksPanel';
import { PluginsInventory } from './components/design-system/organisms/PluginsInventory/PluginsInventory';
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
import { useNotifications } from './hooks/useNotifications';
import { useUpdateToast } from './hooks/useUpdateToast';

type Tab = 'live' | 'agents' | 'workflows' | 'trends' | 'models' | 'insights' | 'workspace' | 'ai' | 'sessions' | 'settings';

// `settings` must stay last — it's pinned to the bottom of the sidebar nav.
// Icons are a separate field so the sidebar can align them in a fixed-width slot
// (emoji glyphs render at different widths, which otherwise misaligns the labels).
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'live', icon: '⚡', label: 'Live Usage' },
  { id: 'agents', icon: '🤖', label: 'Agents · Live Activity' },
  { id: 'workflows', icon: '🔀', label: 'Workflows' },
  { id: 'trends', icon: '📈', label: 'Trends' },
  { id: 'models', icon: '🧠', label: 'Models' },
  { id: 'insights', icon: '🔍', label: 'Insights' },
  { id: 'workspace', icon: '🗂', label: 'Workspace' },
  { id: 'ai', icon: '🪄', label: 'AI Insights' },
  { id: 'sessions', icon: '📋', label: 'Sessions' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
];

type InsightDays = '7' | '14' | '30';
const INSIGHT_DAY_OPTIONS: { value: InsightDays; label: string }[] = [
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
];

// Code vs Cowork series colors for the Trends "sources split" bar.
const SOURCE_COLOR: Record<UsageSource, string> = { code: '#d97757', cowork: '#6366f1' };

// Pill color for the Live Usage tab badge, scaled by 5-hour limit utilization.
function usagePillClasses(pct: number): string {
  if (pct >= 80) return 'bg-red-500/15 text-red-300';
  if (pct >= 50) return 'bg-amber-500/15 text-amber-300';
  return 'bg-emerald-500/15 text-emerald-300';
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const seg = location.pathname.replace(/^\//, '');
  const activeTab: Tab = TABS.some((t) => t.id === seg) ? (seg as Tab) : 'live';
  const [dailyMetric, setDailyMetric] = useState<'tokens' | 'cost'>('tokens');

  // ── Shared state + cross-tab data (from context providers) ──
  const { source, setSource, coworkAvailable, withSrc } = useSource();
  const {
    configData, configLoading, detectedMode, effectiveMode, isApi,
    litellmAvailable, litellmHost, settings, setSettings,
  } = useConfigMode();
  const {
    recentHours, setRecentHours, weekDays, setWeekDays,
    recent, weekly, models, litellm, liveUsage, liveSubagents, workflows, version,
  } = useLiveData();
  const { ai, aiConfig, setAiConfig, aiStatus, aiDisabled, onAiInsight, aiInline } = useAiInsightCtx();

  // ── Source-scoped, single-tab polls (live here until their tab is extracted) ──
  const activity = usePolling<ActivityData>(withSrc('/api/activity'), 30000);
  const tools = usePolling<ToolsData>(withSrc('/api/tools?days=7'), 30000);
  const sessions = usePolling<SessionMeta[]>(withSrc('/api/sessions'), 10000);
  const heatmap = usePolling<HeatmapData>(withSrc('/api/heatmap?days=90'), 60000);
  const projectCosts = usePolling<ProjectData>(withSrc('/api/projects?days=90'), 30000);
  const [limits, setLimits] = useLimits();
  const [analyticsOptOut, setAnalyticsOptOut] = useState(isOptedOut());

  // Insights tab state
  const [insightDays, setInsightDays] = useState<InsightDays>('7');
  const insightDaysNum = insightDays;

  // ── Product analytics (anonymous, path-free events only — see lib/analytics) ──
  useEffect(() => {
    track('tab_viewed', { tab: activeTab });
  }, [activeTab]);
  useEffect(() => {
    if (configData) setUserContext({ plan: configData.subscriptionType, usageMode: effectiveMode });
  }, [configData, effectiveMode]);

  // ── Notifications (toasts replace the old inline banners) ──
  const { notify, dismiss } = useNotifications();
  useUpdateToast(version.data);

  // Claude.ai offline / expired token (subscription mode only). Reactive: shows
  // while the live API reports an error, auto-clears when it recovers.
  useEffect(() => {
    const err = !isApi ? liveUsage.data?.error : undefined;
    if (!err) {
      dismiss('offline');
      return;
    }
    const lc = err.toLowerCase();
    const expired = lc.includes('expired') || lc.includes('no access token');
    notify({
      id: 'offline',
      severity: 'warning',
      title: expired ? 'Claude.ai session expired' : 'Claude.ai connection offline',
      message: expired
        ? 'Token needs a refresh — run `claude` in your terminal and it refreshes automatically.'
        : `${err} — try running \`claude\` in a terminal.`,
    });
  }, [isApi, liveUsage.data?.error, notify, dismiss]);

  // Pay-as-you-go note — shown once per session when API mode is active.
  const apiNotified = useRef(false);
  useEffect(() => {
    if (isApi && configData && !apiNotified.current) {
      apiNotified.current = true;
      notify({
        id: 'api-mode',
        severity: 'info',
        timeoutMs: 9000,
        title: 'API · pay-as-you-go',
        message:
          "No Claude.ai subscription detected — dollar figures are estimated from local logs at Anthropic's API rates. Set spending caps in ⚙ Settings.",
      });
    }
  }, [isApi, configData, notify]);
  const insightErrors = usePolling<InsightsErrors>(withSrc(`/api/insights/errors?days=${insightDaysNum}`), 60000);
  const insightRetries = usePolling<InsightsRetries>(withSrc(`/api/insights/retries?days=${insightDaysNum}`), 60000);
  const insightLanguages = usePolling<InsightsLanguages[]>(withSrc(`/api/insights/languages?days=${insightDaysNum}`), 60000);
  const insightBranches = usePolling<InsightsBranches[]>(withSrc(`/api/insights/branches?days=${insightDaysNum}`), 60000);
  const insightMcp = usePolling<InsightsMcp>(withSrc(`/api/insights/mcp?days=${insightDaysNum}`), 60000);
  const insightComplexity = usePolling<ComplexityPoint[]>(withSrc(`/api/insights/complexity?days=${insightDaysNum}`), 60000);
  const insightYield = usePolling<InsightsYield>(withSrc(`/api/insights/yield?days=${insightDaysNum}`), 60000);
  const insightRejections = usePolling<InsightsRejections>(withSrc(`/api/insights/rejections?days=${insightDaysNum}`), 60000);
  const insightSubagents = usePolling<SubagentStats>(withSrc(`/api/insights/subagents?days=${insightDaysNum}`), 60000);
  const insightCommands = usePolling<CommandUsageData>(`/api/insights/commands?days=${insightDaysNum}`, 60000);
  const insightChurn = usePolling<FileChurnData>(withSrc(`/api/insights/churn?days=${insightDaysNum}`), 60000);
  const workspaceTasks = usePolling<WorkspaceTasksData>('/api/workspace/tasks', 60000);
  const inventory = usePolling<InventoryData>('/api/workspace/inventory', 120000);

  const error = recent.error || weekly.error;
  const empty =
    !recent.loading &&
    !weekly.loading &&
    (recent.data?.totals.totalTokens ?? 0) === 0 &&
    (weekly.data?.totals.totalTokens ?? 0) === 0;

  const block = recent.data?.activeBlock ?? null;
  // Live count of agents working in parallel right now: running subagents +
  // main sessions that are actively working or delegating. Drives the Agents
  // tab badge (visible from any tab) and the Agents section header chips.
  const runningAgentCount =
    (liveSubagents.data?.running.length ?? 0) +
    (liveSubagents.data?.mainAgents.filter((m) => m.active || m.delegating).length ?? 0);
  const liveWorkflowCount = workflows.data?.live.length ?? 0;
  // Current 5-hour limit utilization (already 0–100) for the Live Usage tab badge.
  // Only when the live API returned a value for an active block (no error).
  const fiveHourPct =
    liveUsage.data && !liveUsage.data.error && liveUsage.data.five_hour?.resets_at != null
      ? Math.round(liveUsage.data.five_hour.utilization)
      : null;
  const topModel = models.data?.models[0];
  const weeklyEffective = weekly.data?.totals.effectiveTokens ?? 0;
  const prevWeeklyEffective = weekly.data?.prevTotals.effectiveTokens ?? 0;

  // Normalize to cost per day from whatever range is selected
  const costPerDay = (weekly.data?.totals.cost ?? 0) / weekDays;
  // Actual billed spend from the LiteLLM gateway (null on error / not-yet-loaded →
  // the card is simply hidden, so the dashboard degrades gracefully).
  const litellmSpend = litellm.data && !('error' in litellm.data) ? litellm.data : null;
  // Real billed cost (today / last 7 days / month-to-date) for the Live-tab spend
  // widgets, when a LiteLLM gateway is configured — so API SPENDING and the daily-cap
  // ring reflect what the gateway actually bills instead of the local-logs estimate.
  // Today = the most recent daily entry; week = the last 7 of the daily series.
  const litellmActual = litellmAvailable && litellmSpend
    ? {
        today: litellmSpend.daily[litellmSpend.daily.length - 1]?.cost ?? 0,
        week: litellmSpend.daily.slice(-7).reduce((s, d) => s + d.cost, 0),
        month: litellmSpend.monthToDate,
        note: litellmHost ? `actual · via ${litellmHost}` : 'actual billed',
      }
    : null;
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

  const sidebarTabs = TABS.map((t): { id: string; icon: string; label: string; badge?: ReactNode } => {
    const base = { id: t.id, icon: t.icon, label: t.label };
    if (t.id === 'agents' && runningAgentCount > 0) {
      return {
        ...base,
        badge: (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-clay-500/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-clay-300"
            title={`${runningAgentCount} agent${runningAgentCount === 1 ? '' : 's'} running right now`}
          >
            <span className="pulse-dot flex-none" />
            {runningAgentCount}
          </span>
        ),
      };
    }
    if (t.id === 'live' && fiveHourPct != null) {
      return {
        ...base,
        badge: (
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${usagePillClasses(fiveHourPct)}`}
            title={`5-hour limit: ${fiveHourPct}% used`}
          >
            {fiveHourPct}%
          </span>
        ),
      };
    }
    if (t.id === 'workflows' && liveWorkflowCount > 0) {
      return {
        ...base,
        badge: (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-clay-500/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-clay-300"
            title={`${liveWorkflowCount} workflow${liveWorkflowCount === 1 ? '' : 's'} running right now`}
          >
            <span className="pulse-dot flex-none" />
            {liveWorkflowCount}
          </span>
        ),
      };
    }
    return base;
  });

  return (
    <div className="flex h-screen">
      <Sidebar
        tabs={sidebarTabs}
        activeTab={activeTab}
        onNavigate={(id) => navigate(`/${id}`)}
        claudeDir={recent.claudeDir ?? null}
        version={version.data}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <header className="mb-6 flex items-center justify-end gap-4">
            {coworkAvailable && (
              <div className="flex items-center gap-2" title="Filter usage by surface: Claude Code CLI vs Cowork (desktop local-agent mode)">
                <span className="text-[11px] uppercase tracking-wide text-zinc-600">source</span>
                <ToggleGroup<SourceFilter>
                  options={SOURCE_OPTIONS}
                  value={source}
                  onChange={setSource}
                />
              </div>
            )}
            <LiveBadge computedAt={recent.computedAt} error={error} />
          </header>

      {activeTab === 'settings' ? (
        <SettingsView
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
          aiConfig={aiConfig}
          onChangeAiConfig={setAiConfig}
        />
      ) : empty ? (
        <div className="card mt-6 p-12 text-center text-zinc-400">
          No usage logs found. Use Claude Code, then this dashboard will populate.
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── LIVE TAB ── */}
          {activeTab === 'live' && (
            <>
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
                    todayActualCost={litellmActual?.today ?? null}
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
              {configData && !isApi && (
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
                  actual={litellmActual ?? undefined}
                />
              )}
            </>
          )}

          {/* ── AGENTS TAB ── */}
          {activeTab === 'agents' && (
            <AgentActivity data={liveSubagents.data} loading={liveSubagents.loading} />
          )}

          {/* ── WORKFLOWS TAB ── */}
          {activeTab === 'workflows' && (
            <WorkflowsView data={workflows.data} loading={workflows.loading} />
          )}

          {/* ── TRENDS TAB ── */}
          {activeTab === 'trends' && (
            <>
              {/* Window selector — drives the cost stat cards, the estimate chart,
                  and (when present) the LiteLLM actual-billed chart. */}
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-zinc-500">Spending · last {weekDays} days</span>
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
                      sub={topModel ? `top: ${shortModel(topModel.model)}` : undefined}
                      help={
                        litellmAvailable
                          ? "Estimated from your local logs at Anthropic's public API rates — a reference figure. Compare it with “Actual billed” (your gateway's real charge): the two differ because the gateway also bills failed/retried requests, uses calendar-day windows, and reflects a more up-to-date snapshot."
                          : "What this usage would cost at Anthropic's pay-as-you-go API rates. Your subscription has no per-token bill — this is a reference figure only."
                      }
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

              {/* Actual billed (LiteLLM gateway): month-to-date + per-day window,
                  side by side. Gated + degrades silently when the gateway errors. */}
              {litellmAvailable && litellmSpend && (() => {
                const daily = litellmSpend.daily;
                const windowTotal = daily.reduce((s, d) => s + d.cost, 0);
                const prev = litellmSpend.prevMonthToDate;
                const monthDelta = prev > 0 ? Math.round(((litellmSpend.monthToDate - prev) / prev) * 100) : null;
                const fail = litellmSpend.monthFailed;
                const reqTotal = litellmSpend.monthSuccessful + fail;
                const successPct = reqTotal > 0 ? (litellmSpend.monthSuccessful / reqTotal) * 100 : null;
                const tok = litellmSpend.monthTokens;
                const tokTotal = tok.prompt + tok.completion + tok.cacheRead + tok.cacheCreate;
                const tokPct = (n: number) => (tokTotal > 0 ? `${(n / tokTotal) * 100}%` : '0%');
                return (
                  <Section
                    title="Actual billed"
                    help="Real cost billed by your LiteLLM gateway, from its /user/daily/activity report. Month-to-date covers the 1st of the month → today; the daily view breaks out each calendar day in the selected window, including today. May exceed the estimate because the gateway also bills failed/retried requests."
                    right={
                      litellmHost ? (
                        <span className="text-xs text-zinc-500">
                          gateway <span className="font-semibold text-zinc-300">{litellmHost}</span>
                        </span>
                      ) : undefined
                    }
                  >
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                      {/* Month-to-date */}
                      <div className="flex flex-col justify-center rounded-xl bg-emerald-500/[0.06] p-5 ring-1 ring-emerald-500/20">
                        <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-300/80">
                          {litellmSpend.monthLabel} · month-to-date
                        </div>
                        <div className="mt-1.5 text-4xl font-bold tabular-nums text-emerald-400">
                          {usd(litellmSpend.monthToDate)}
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          {litellmSpend.monthRequests.toLocaleString()} requests since the 1st
                        </div>
                        {monthDelta !== null && (
                          <div className="mt-1.5 text-xs text-zinc-500">
                            <span className={monthDelta >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                              {monthDelta >= 0 ? '▲' : '▼'} {Math.abs(monthDelta)}%
                            </span>{' '}
                            vs {usd(prev)} in {litellmSpend.prevMonthLabel} (same point)
                          </div>
                        )}
                        {successPct !== null && (
                          <div className="mt-1.5 text-xs text-zinc-500">
                            <span className={successPct >= 99 ? 'text-emerald-400' : successPct >= 95 ? 'text-amber-400' : 'text-red-400'}>
                              {successPct.toFixed(1)}% success
                            </span>
                            {fail > 0 && <span className="text-zinc-600"> · {fail.toLocaleString()} failed</span>}
                          </div>
                        )}
                        {litellmSpend.lifetime.user > 0 && (
                          <div className="mt-1 text-xs text-zinc-600">
                            lifetime · <span className="text-zinc-400">{usd(litellmSpend.lifetime.user)}</span>
                          </div>
                        )}
                      </div>
                      {/* Daily breakdown over the selected window */}
                      <div className="lg:col-span-2">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            Last {weekDays} days
                          </span>
                          <span className="text-xs text-zinc-400">
                            <span className="font-semibold text-zinc-200">{usd(windowTotal)}</span> total
                          </span>
                        </div>
                        <LiteLlmDailyChart days={daily} />
                      </div>
                    </div>
                    {tokTotal > 0 && (
                      <div className="mt-5 border-t border-white/10 pt-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            Token mix · {litellmSpend.monthLabel}
                          </span>
                          <span className="text-xs text-zinc-400">{compact(tokTotal)} total</span>
                        </div>
                        <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10">
                          <div style={{ width: tokPct(tok.prompt), backgroundColor: '#d97757' }} />
                          <div style={{ width: tokPct(tok.completion), backgroundColor: '#6366f1' }} />
                          <div style={{ width: tokPct(tok.cacheCreate), backgroundColor: '#f59e0b' }} />
                          <div style={{ width: tokPct(tok.cacheRead), backgroundColor: '#10b981' }} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                          <LegendDot color="#d97757" label={`Input · ${compact(tok.prompt)}`} size="sm" />
                          <LegendDot color="#6366f1" label={`Output · ${compact(tok.completion)}`} size="sm" />
                          <LegendDot color="#f59e0b" label={`Cache write · ${compact(tok.cacheCreate)}`} size="sm" />
                          <LegendDot color="#10b981" label={`Cache read · ${compact(tok.cacheRead)}`} size="sm" />
                        </div>
                      </div>
                    )}
                  </Section>
                );
              })()}

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
                      <div className="flex flex-1 h-3 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10">
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
                    help="Daily tokens (or equivalent cost), stacked by model. The dotted segment past today is a projection from your recent daily average. Toggle tokens/cost on the right; change the window with the selector at the top."
                    aiSection="trends"
                    aiDisabled={aiDisabled}
                    aiLoading={ai.states.get('trends')?.loading}
                    onAiInsight={() => onAiInsight('trends', weekly.data)}
                    aiInsight={aiInline('trends')}
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
                  aiSection="models"
                  aiDisabled={aiDisabled}
                  aiLoading={ai.states.get('models')?.loading}
                  onAiInsight={() => onAiInsight('models', models.data)}
                  aiInsight={aiInline('models')}
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
                  aiSection="tools"
                  aiDisabled={aiDisabled}
                  aiLoading={ai.states.get('tools')?.loading}
                  onAiInsight={() => onAiInsight('tools', tools.data)}
                  aiInsight={aiInline('tools')}
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
                aiSection="errors"
                aiDisabled={aiDisabled}
                aiLoading={ai.states.get('errors')?.loading}
                onAiInsight={() => onAiInsight('errors', insightErrors.data)}
                aiInsight={aiInline('errors')}
              >
                <ErrorBreakdown data={insightErrors.data} />
              </Section>

              {/* Languages | Branches */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Section
                  title="Languages · edits by file type"
                  help="Files touched in this window, bucketed by extension into a language. Solid = edits/writes; dimmed = reads. Shows what kinds of files the work concentrated on."
                  aiSection="languages"
                  aiDisabled={aiDisabled}
                  aiLoading={ai.states.get('languages')?.loading}
                  onAiInsight={() => onAiInsight('languages', insightLanguages.data)}
                  aiInsight={aiInline('languages')}
                >
                  <LanguageBreakdown data={insightLanguages.data} />
                </Section>
                <Section
                  title="Branches · token usage by git branch"
                  help="Effective tokens, cost and session count attributed to each git branch (shown as repo / branch). Reflects which branches the most work went into."
                  aiSection="branches"
                  aiDisabled={aiDisabled}
                  aiLoading={ai.states.get('branches')?.loading}
                  onAiInsight={() => onAiInsight('branches', insightBranches.data)}
                  aiInsight={aiInline('branches')}
                >
                  <BranchBreakdown data={insightBranches.data} />
                </Section>
              </div>

              {/* MCP | Rejections */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Section
                  title="MCP vs built-in · tool call split"
                  help="How tool calls split between Claude's built-in tools and tools from connected MCP servers. The per-server table lists call counts and how many failed (errors), one row per MCP server."
                  aiSection="mcp"
                  aiDisabled={aiDisabled}
                  aiLoading={ai.states.get('mcp')?.loading}
                  onAiInsight={() => onAiInsight('mcp', insightMcp.data)}
                  aiInsight={aiInline('mcp')}
                >
                  <McpBreakdown data={insightMcp.data} />
                </Section>
                <Section
                  title="Permission rejections · by tool"
                  help="Tool calls you declined when Claude asked for permission, grouped by tool. High counts flag tools Claude reaches for that you often block."
                  aiSection="rejections"
                  aiDisabled={aiDisabled}
                  aiLoading={ai.states.get('rejections')?.loading}
                  onAiInsight={() => onAiInsight('rejections', insightRejections.data)}
                  aiInsight={aiInline('rejections')}
                >
                  <RejectionsPanel data={insightRejections.data} />
                </Section>
              </div>

              {/* Complexity scatter — full width */}
              <Section
                title="Session complexity · tool calls vs tokens (dot size = subagents)"
                help="One dot per session: x = number of tool calls, y = effective tokens, dot size = subagents spawned. Dots to the upper-right are the heaviest, most complex sessions."
                aiSection="complexity"
                aiDisabled={aiDisabled}
                aiLoading={ai.states.get('complexity')?.loading}
                onAiInsight={() => onAiInsight('complexity', insightComplexity.data)}
                aiInsight={aiInline('complexity')}
              >
                <ComplexityScatter data={insightComplexity.data} />
              </Section>

              {/* Yield | Subagent stats */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Section
                  title="Yield · committed vs uncommitted sessions"
                  help="Sessions that ran a git commit vs those that didn't — a rough proxy for which work landed. Lists the biggest uncommitted sessions by tokens."
                  aiSection="yield"
                  aiDisabled={aiDisabled}
                  aiLoading={ai.states.get('yield')?.loading}
                  onAiInsight={() => onAiInsight('yield', insightYield.data)}
                  aiInsight={aiInline('yield')}
                >
                  <YieldPanel data={insightYield.data} />
                </Section>
                <Section
                  title="Subagent stats · delegation analysis"
                  help="Subagent (Task/Agent) spawns in this window: total, average per delegating session, and breakdowns by subagent type and model."
                  aiSection="subagents"
                  aiDisabled={aiDisabled}
                  aiLoading={ai.states.get('subagents')?.loading}
                  onAiInsight={() => onAiInsight('subagents', insightSubagents.data)}
                  aiInsight={aiInline('subagents')}
                >
                  <SubagentStatsPanel data={insightSubagents.data} />
                </Section>
              </div>

              {/* Retry panel — standalone */}
              <Section
                title="Edit retries · one-shot analysis"
                help="Edit/Write calls that succeeded first try vs those retried after an error, with the estimated tokens and cost wasted on the retries."
                aiSection="retries"
                aiDisabled={aiDisabled}
                aiLoading={ai.states.get('retries')?.loading}
                onAiInsight={() => onAiInsight('retries', insightRetries.data)}
                aiInsight={aiInline('retries')}
              >
                <RetryPanel data={insightRetries.data} />
              </Section>

              {/* Commands | File churn */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Section
                  title="Commands · slash-command & skill usage"
                  help="How often each slash command / skill was invoked in this window, from your local command history. Reflects which commands you reach for most."
                  aiSection="commands"
                  aiDisabled={aiDisabled}
                  aiLoading={ai.states.get('commands')?.loading}
                  onAiInsight={() => onAiInsight('commands', insightCommands.data)}
                  aiInsight={aiInline('commands')}
                >
                  <CommandUsage data={insightCommands.data} />
                </Section>
                <Section
                  title="File churn · most-edited files"
                  help="Files edited most often (Edit/Write/MultiEdit calls) in this window. Hover a row for the full path. High churn flags the files the work concentrated on."
                  aiSection="churn"
                  aiDisabled={aiDisabled}
                  aiLoading={ai.states.get('churn')?.loading}
                  onAiInsight={() => onAiInsight('churn', insightChurn.data)}
                  aiInsight={aiInline('churn')}
                >
                  <FileChurn data={insightChurn.data} />
                </Section>
              </div>
            </>
          )}

          {/* ── WORKSPACE TAB ── */}
          {activeTab === 'workspace' && (
            <>
              <Section
                title="Tasks & plans"
                help="Tasks tracked by Claude Code's task tooling (completion + blocked) and the plan documents under ~/.claude/plans, with size and age."
                aiSection="tasks"
                aiDisabled={aiDisabled}
                aiLoading={ai.states.get('tasks')?.loading}
                onAiInsight={() => onAiInsight('tasks', workspaceTasks.data)}
                aiInsight={aiInline('tasks')}
              >
                <TasksPanel data={workspaceTasks.data} />
              </Section>
              <Section
                title="Plugins & MCP · installed integrations"
                help="Installed plugins, registered MCP servers (global vs project-scoped), plugin marketplaces and any configured hooks — your local Claude Code integration inventory."
                aiSection="plugins"
                aiDisabled={aiDisabled}
                aiLoading={ai.states.get('plugins')?.loading}
                onAiInsight={() => onAiInsight('plugins', inventory.data)}
                aiInsight={aiInline('plugins')}
              >
                <PluginsInventory data={inventory.data} />
              </Section>
            </>
          )}

          {/* ── AI INSIGHTS TAB ── */}
          {activeTab === 'ai' && (
            <AiChat
              status={aiStatus.data ?? null}
              config={aiConfig}
              onChangeConfig={setAiConfig}
              onAsked={() => track('ai_chat_asked')}
              onOpenSettings={() => navigate('/settings')}
            />
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
                    {configData ? (
                      <ConfigProfile config={configData} isApi={isApi} />
                    ) : configLoading ? (
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
        </div>
      </main>
    </div>
  );
}
