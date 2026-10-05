import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentTraffic } from './useAgentTraffic';
import { useConfigMode } from './useConfigMode';
import { useCostMetrics } from './useCostMetrics';
import { NO_LIMITS, useLimits, usePlatformLimits } from './useLimits';
import { useLiteLlmActual } from './useLiteLlmActual';
import { useLiveData, weeklyPollMs } from './useLiveData';
import { bindingLimit, useLiveMetrics } from './useLiveMetrics';
import { usePolling } from './usePolling';
import { useSource } from './useSource';
import { buildBudgetRows, type BudgetInput, type BudgetPeriod } from '@/lib/budget';
import { coverageDays } from '@/lib/coverage';
import type { Limits } from '@/lib/limits';
import {
  TREND_DAYS,
  buildClaudeLimits,
  buildCodexLimits,
  buildRunning,
  buildToday,
  limitsNote,
  type LimitGlanceView,
  type RunningNowView,
  type SpendTodayView,
} from '@/lib/views/overview';
import type { WeekStart } from '@/lib/week';
import type { CodexConfigData, WeeklyData } from '@/types';

export type OverviewNavigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => void;

export interface OverviewPageView {
  limits: LimitGlanceView[];
  limitsNote: string;
  running: RunningNowView;
  today: SpendTodayView[];
  onNavigate: OverviewNavigate;
}

const WEEKLY_7D = '/api/usage/weekly?days=7';
const CODEX_CONFIG_POLL_MS = 120_000;
const TICK_MS = 60_000;
const NO_BUDGET: BudgetPeriod[] = [];

function scopedBudget(
  weekly: WeeklyData | null,
  limits: Limits,
  actual: BudgetInput['actual'],
  weekStart: WeekStart,
): BudgetPeriod[] | null {
  if (!weekly) return null;
  const now = Date.now();
  return buildBudgetRows({
    limits,
    buckets: weekly.buckets,
    costPerDay: weekly.totals.cost / coverageDays(weekly, TREND_DAYS, now),
    weekStart,
    actual,
    now,
  });
}

export function useOverviewPage(): OverviewPageView {
  const navigate = useNavigate();
  const { platform, showClaude, showCodex } = useSource();
  const { configData, configLoading, isApi, weekStart } = useConfigMode();
  const { liveUsage, codexLive, liveWeekly, liveSubagents, codexAgents, workflows } = useLiveData();
  const [caps] = usePlatformLimits();
  const limits = useLimits();
  const { costPerDay } = useCostMetrics();
  const { litellmActual } = useLiteLlmActual();
  const traffic = useAgentTraffic();
  const { liveWorkflowCount } = useLiveMetrics();

  const both = platform === 'both';
  const claudeScoped = usePolling<WeeklyData>(both ? `${WEEKLY_7D}&source=claude` : '', weeklyPollMs(TREND_DAYS));
  const codexScoped = usePolling<WeeklyData>(both ? `${WEEKLY_7D}&source=codex` : '', weeklyPollMs(TREND_DAYS));
  const codexConfig = usePolling<CodexConfigData>(showCodex ? '/api/codex/config' : '', CODEX_CONFIG_POLL_MS);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((count) => count + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const hasActual = litellmActual !== null;
  const actualToday = litellmActual?.today ?? 0;
  const actualWeek = litellmActual?.week ?? 0;
  const actualMonth = litellmActual?.month ?? 0;
  const actual = useMemo(
    () => (hasActual ? { today: actualToday, week: actualWeek, month: actualMonth } : null),
    [hasActual, actualToday, actualWeek, actualMonth],
  );

  const viewBudget = useMemo(
    () =>
      liveWeekly.data
        ? buildBudgetRows({
            limits,
            buckets: liveWeekly.data.buckets,
            costPerDay,
            weekStart,
            actual: platform === 'claude' ? actual : null,
            now: Date.now(),
          })
        : null,
    [liveWeekly.data, limits, costPerDay, weekStart, platform, actual, tick],
  );

  const configPending = !configData && configLoading;
  const claudeLive = configPending ? null : liveUsage.data;
  const claudeCapsMode = showClaude && (isApi || !!claudeLive?.error);
  const codexApiKey = codexConfig.data?.authMode === 'apikey';
  const codexConfigPending = showCodex && !codexConfig.data && codexConfig.loading;
  const codexLiveData = codexConfigPending && codexLive.data?.error ? null : codexLive.data;
  const codexLoading = codexConfigPending || codexLive.loading;
  const codexCapsMode = showCodex && (codexApiKey || !!codexLiveData?.error);

  const claudeBudget = useMemo(() => {
    if (!claudeCapsMode) return NO_BUDGET;
    return both ? scopedBudget(claudeScoped.data, caps.claude, actual, weekStart) : viewBudget;
  }, [claudeCapsMode, both, claudeScoped.data, caps.claude, actual, weekStart, viewBudget]);

  const codexBudget = useMemo(() => {
    if (!codexCapsMode) return NO_BUDGET;
    return both ? scopedBudget(codexScoped.data, caps.codex ?? NO_LIMITS, null, weekStart) : viewBudget;
  }, [codexCapsMode, both, codexScoped.data, caps.codex, weekStart, viewBudget]);

  const weeklyFailed = !liveWeekly.data && !!liveWeekly.error;
  const claudeBudgetFailed = both ? !claudeScoped.data && !!claudeScoped.error : weeklyFailed;
  const codexBudgetFailed = both ? !codexScoped.data && !!codexScoped.error : weeklyFailed;
  const plan = configData?.subscriptionType ?? configData?.rateLimitTier;
  const claudeLoading = configPending || liveUsage.loading;
  const limitCards = useMemo(() => {
    const now = Date.now();
    const cards: LimitGlanceView[] = [];
    if (showClaude) {
      cards.push(
        buildClaudeLimits({
          live: claudeLive,
          loading: claudeLoading,
          plan,
          apiMode: isApi,
          budget: claudeBudget,
          budgetFailed: claudeBudgetFailed,
          pickBinding: bindingLimit,
          now,
        }),
      );
    }
    if (showCodex) {
      cards.push(
        buildCodexLimits({
          live: codexLiveData,
          loading: codexLoading,
          apiKey: codexApiKey,
          budget: codexBudget,
          budgetFailed: codexBudgetFailed,
          pickBinding: bindingLimit,
          now,
        }),
      );
    }
    return cards;
  }, [
    showClaude, showCodex, claudeLive, claudeLoading, plan, isApi, claudeBudget, claudeBudgetFailed,
    codexLiveData, codexLoading, codexApiKey, codexBudget, codexBudgetFailed, tick,
  ]);

  const claudeAgents = showClaude ? liveSubagents.data : null;
  const codexThreads = showCodex ? codexAgents.data : null;
  const liveRuns = showClaude ? workflows.data?.live : undefined;
  const agentsLoading = (showClaude && liveSubagents.loading) || (showCodex && codexAgents.loading);
  const agentsFailed = (showClaude && !!liveSubagents.error) || (showCodex && !!codexAgents.error);
  const running = useMemo(
    () =>
      buildRunning({
        claude: claudeAgents,
        codex: codexThreads,
        workflows: liveRuns ?? [],
        showWorkflows: showClaude,
        tagCodex: both,
        running: traffic.running,
        waiting: traffic.waiting,
        liveWorkflows: liveWorkflowCount,
        loading: agentsLoading,
        failed: agentsFailed,
      }),
    [
      claudeAgents, codexThreads, liveRuns, showClaude, both, traffic.running, traffic.waiting,
      liveWorkflowCount, agentsLoading, agentsFailed,
    ],
  );

  const today = useMemo(
    () =>
      buildToday({
        platform,
        weekly: liveWeekly.data,
        loading: liveWeekly.loading,
        claudeWeekly: both ? claudeScoped.data : null,
        codexWeekly: both ? codexScoped.data : null,
        dayBudget: viewBudget?.find((row) => row.key === 'day') ?? null,
        now: Date.now(),
      }),
    [platform, liveWeekly.data, liveWeekly.loading, both, claudeScoped.data, codexScoped.data, viewBudget],
  );

  const onNavigate = useCallback<OverviewNavigate>(
    (event, href) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(href);
    },
    [navigate],
  );

  return { limits: limitCards, limitsNote: limitsNote(limitCards), running, today, onNavigate };
}
