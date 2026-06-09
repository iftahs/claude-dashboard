import { useState, useMemo } from 'react';
import { usePolling } from './hooks/usePolling';
import { useLimits } from './hooks/useLimits';
import type { Limits } from './hooks/useLimits';
import type { ActivityData, ModelsData, RecentData, WeeklyData, ToolsData, ClaudeConfig, SessionMeta, LiveUsageData } from './types';
import { StatCard } from './components/StatCard';
import { BlockGauge } from './components/BlockGauge';
import { UsageBarChart } from './components/UsageBarChart';
import { ModelBreakdown } from './components/ModelBreakdown';
import { ActivityHeatmap } from './components/ActivityHeatmap';
import { ToolUsage } from './components/ToolUsage';
import { LiveBadge } from './components/LiveBadge';
import { LimitsPanel } from './components/LimitsPanel';
import { CostCalculation } from './components/CostCalculation';
import { ConfigProfile } from './components/ConfigProfile';
import { PlanUsage } from './components/PlanUsage';
import { ProjectBreakdown } from './components/ProjectBreakdown';
import { SessionHistoryTable } from './components/SessionHistoryTable';
import {
  StatCardSkeleton,
  ChartSkeleton,
  GaugeSkeleton,
  DonutSkeleton,
  BarsSkeleton,
  HeatmapSkeleton,
  Skeleton,
} from './components/Skeleton';
import { compact, usd, hourLabel, dayLabel, shortModel } from './lib/format';

const POLL = 5000;

type Tab = 'live' | 'trends' | 'models' | 'sessions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: '⚡ Live' },
  { id: 'trends', label: '📈 Trends' },
  { id: 'models', label: '🧠 Models' },
  { id: 'sessions', label: '📋 Sessions' },
];

function Section({
  title,
  children,
  right,
  className = '',
  grow = false,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  grow?: boolean;
}) {
  return (
    <div className={`card p-5 ${grow ? 'flex flex-col h-full' : ''} ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
        {right}
      </div>
      <div className={grow ? 'flex-1 flex flex-col justify-end' : ''}>{children}</div>
    </div>
  );
}

/** API spending gauges — only rendered when at least one limit is configured */
function SpendingLimits({ limits, costPerDay }: { limits: Limits; costPerDay: number }) {
  const rows = [
    limits.dailyLimit != null
      ? { label: 'Daily', cost: costPerDay, limit: limits.dailyLimit }
      : null,
    limits.weeklyLimit != null
      ? { label: 'Weekly', cost: costPerDay * 7, limit: limits.weeklyLimit }
      : null,
    limits.monthlyLimit != null
      ? { label: 'Monthly (est.)', cost: costPerDay * 30, limit: limits.monthlyLimit }
      : null,
  ].filter(Boolean) as { label: string; cost: number; limit: number }[];

  if (rows.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">API Spending</h3>
        <span className="text-xs text-zinc-600">estimated from local logs</span>
      </div>
      <div className="space-y-4">
        {rows.map(({ label, cost, limit }) => {
          const pct = Math.min(100, (cost / limit) * 100);
          const color = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981';
          return (
            <div key={label}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">{label}</span>
                <span className="font-mono" style={{ color }}>
                  ${cost.toFixed(2)}{' '}
                  <span className="text-zinc-600">/ ${limit}</span>
                  <span className="ml-1.5 text-zinc-500">({pct.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-600">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [weekDays, setWeekDays] = useState(7);
  const [recentHours, setRecentHours] = useState(12);
  const recent = usePolling<RecentData>(`/api/usage/recent?hours=${recentHours}`, POLL);
  const weekly = usePolling<WeeklyData>(`/api/usage/weekly?days=${weekDays}`, POLL);
  const models = usePolling<ModelsData>('/api/usage/models?days=7', POLL);
  const activity = usePolling<ActivityData>('/api/activity', 30000);
  const tools = usePolling<ToolsData>('/api/tools?days=7', 30000);
  const config = usePolling<ClaudeConfig>('/api/config', 60000);
  const sessions = usePolling<SessionMeta[]>('/api/sessions', 10000);
  const liveUsage = usePolling<LiveUsageData>('/api/usage/live', 15000);
  const [limits, setLimits] = useLimits();
  const [showLimits, setShowLimits] = useState(false);

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
          <button
            onClick={() => setShowLimits((v) => !v)}
            className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 ring-1 ring-white/10 hover:text-zinc-200"
            title="Configure API spending limits"
          >
            ⚙ limits
          </button>
          <LiveBadge computedAt={recent.computedAt} error={error} />
        </div>
      </header>

      {showLimits && (
        <LimitsPanel limits={limits} onChange={setLimits} onClose={() => setShowLimits(false)} />
      )}

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl bg-ink-800/60 p-1 ring-1 ring-white/5">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              activeTab === id
                ? 'bg-ink-700 text-zinc-100 shadow-sm ring-1 ring-white/10'
                : 'text-zinc-500 hover:text-zinc-300'
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
              {/* Stat cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {recent.loading || weekly.loading ? (
                  <>
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                  </>
                ) : (
                  <>
                    <StatCard
                      label="Effective tokens · current 5h block"
                      value={compact(block?.totals.effectiveTokens ?? 0)}
                      accent="#d97757"
                      sub={
                        block?.totals.cacheReadTokens
                          ? `+${compact(block.totals.cacheReadTokens)} cache reads`
                          : 'no cache reads'
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
                    />
                    <StatCard
                      label={`Est. equivalent cost · ${weekDays}d`}
                      value={usd(weekly.data?.totals.cost ?? 0)}
                      sub={topModel ? `top: ${shortModel(topModel.model)}` : undefined}
                    />
                  </>
                )}
              </div>

              {/* Block gauge + hourly chart */}
              <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
                {recent.loading ? (
                  <GaugeSkeleton />
                ) : (
                  <BlockGauge block={block} liveUsage={liveUsage.data} />
                )}
                <div className="flex flex-col lg:col-span-2">
                  <Section
                    title={`Last ${recentHours} hours · hourly tokens by model`}
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

              {/* Plan usage bars */}
              {config.data && (
                <PlanUsage block={block} weekly={weekly.data} liveUsage={liveUsage.data} />
              )}

              {/* API spending gauges (only when limits configured) */}
              {hasSpendingLimits && (
                <SpendingLimits limits={limits} costPerDay={costPerDay} />
              )}
            </>
          )}

          {/* ── TRENDS TAB ── */}
          {activeTab === 'trends' && (
            <>
              {/* Daily chart */}
              {(() => {
                const delta =
                  prevWeeklyEffective > 0
                    ? Math.round(
                        ((weeklyEffective - prevWeeklyEffective) / prevWeeklyEffective) * 100
                      )
                    : null;
                return (
                  <Section
                    title={`Last ${weekDays} days · daily tokens by model`}
                    right={
                      <div className="flex items-center gap-3">
                        {delta !== null && (
                          <span
                            className={`text-xs font-semibold ${delta >= 0 ? 'text-red-400' : 'text-emerald-400'}`}
                          >
                            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs prev period
                          </span>
                        )}
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
                      <UsageBarChart buckets={weekly.data.buckets} labelFor={dayLabel} />
                    ) : weekly.loading ? (
                      <ChartSkeleton />
                    ) : null}
                    {!weekly.loading && (
                      <div className="mt-3 rounded-xl bg-ink-700/50 px-4 py-2.5 text-xs text-zinc-400">
                        <span className="text-zinc-200">{compact(weeklyEffective)}</span> effective tokens
                        {prevWeeklyEffective > 0 && (
                          <span className="ml-2 text-zinc-500">
                            · {weekDays === 7 ? 'prev week' : `prev ${weekDays / 7} weeks`}{' '}
                            {compact(prevWeeklyEffective)}
                          </span>
                        )}
                      </div>
                    )}
                  </Section>
                );
              })()}

              {/* Activity heatmap */}
              <Section title="Daily activity · last 18 weeks">
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
                <Section title="Model breakdown · 7d">
                  {models.data ? (
                    <ModelBreakdown models={models.data.models} />
                  ) : models.loading ? (
                    <DonutSkeleton />
                  ) : null}
                </Section>
                <Section title="Tool usage · 7d">
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

          {/* ── SESSIONS TAB ── */}
          {activeTab === 'sessions' && (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1">
                  {config.data ? (
                    <ConfigProfile config={config.data} />
                  ) : config.loading ? (
                    <div className="card p-5 flex items-center justify-center min-h-[200px]">
                      <Skeleton className="h-full w-full rounded-2xl" />
                    </div>
                  ) : null}
                </div>
                <div className="lg:col-span-2">
                  {sessions.data ? (
                    <ProjectBreakdown sessions={sessions.data} periodDays={totalPeriodDays} />
                  ) : sessions.loading ? (
                    <div className="card p-5 flex items-center justify-center min-h-[200px]">
                      <Skeleton className="h-full w-full rounded-2xl" />
                    </div>
                  ) : null}
                </div>
              </div>

              {sessions.data ? (
                <SessionHistoryTable sessions={sessions.data} periodDays={totalPeriodDays} />
              ) : sessions.loading ? (
                <div className="card p-5 min-h-[150px] flex items-center justify-center">
                  <Skeleton className="h-full w-full rounded-2xl" />
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
