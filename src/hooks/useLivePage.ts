import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfigMode } from './useConfigMode';
import { useCostMetrics } from './useCostMetrics';
import { hasCaps, useLimits, usePlatformLimits } from './useLimits';
import { useLiteLlmActual } from './useLiteLlmActual';
import { useLiveData } from './useLiveData';
import { usePolling } from './usePolling';
import { useSource } from './useSource';
import { buildBudgetRows } from '@/lib/budget';
import { resolveLimitAlerts } from '@/lib/limits';
import { PLATFORM_NOUN, titleScope } from '@/lib/platform';
import {
  RECENT_HOUR_OPTIONS,
  buildClaudeGauge,
  buildClaudePlans,
  buildCodexGauge,
  buildCodexPlan,
  buildContributors,
  buildHourly,
  buildLimitHits,
  buildSpendCaps,
  claudeExtraUsageView,
  codexCreditsView,
  type AlertPermission,
  type ContribRange,
  type ExtraUsageView,
  type HourlyUsageView,
  type LimitContributorsView,
  type LimitGaugeView,
  type LimitHitsView,
  type LivePlatform,
  type PlanLimitsView,
  type SpendCapsView,
} from '@/lib/views/live';
import type { AccountLive, AccountsLiveData, CodexBlock, ContributorsData, LimitHitsData } from '@/types';

export interface LiveHourOption {
  value: string;
  label: string;
}

export interface LivePageView {
  both: boolean;
  hours: string;
  hourOptions: readonly LiveHourOption[];
  onHoursChange: (value: string) => void;
  gauges: LimitGaugeView[];
  hourly: HourlyUsageView;
  plans: PlanLimitsView[];
  extras: ExtraUsageView[];
  // The live limits answered (or failed), so these blocks have their final shape.
  windowSettled: boolean;
  plansSettled: boolean;
  contributors: LimitContributorsView[];
  onContribRange: (key: string, range: ContribRange) => void;
  limitHits: LimitHitsView;
  spendCaps: SpendCapsView | null;
}

const TICK_MS = 1000;
const ACCOUNTS_POLL_MS = 15_000;
const CODEX_BLOCK_POLL_MS = 5000;
const SLOW_POLL_MS = 60_000;
const DEFAULT_RANGE: ContribRange = 'day';
const SCOPE_KEY = 'scope';
const NO_ACCOUNTS: AccountLive[] = [];
const NO_PLANS: PlanLimitsView[] = [];
const HOUR_OPTIONS: readonly LiveHourOption[] = RECENT_HOUR_OPTIONS.map((hours) => ({ value: String(hours), label: `${hours}h` }));

function contributorsUrl(source: LivePlatform): string {
  return `/api/usage/contributors?source=${source}`;
}

// Countdown views are rebuilt every second; the previous object is kept while the text is unchanged so memoised cards skip the render.
function useStableView<T>(view: T): T {
  const kept = useRef(view);
  if (kept.current !== view && JSON.stringify(kept.current) !== JSON.stringify(view)) kept.current = view;
  return kept.current;
}

function alertPermission(alertsOn: boolean): AlertPermission | null {
  if (!alertsOn) return null;
  const state = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied';
  if (state === 'granted') return null;
  return state === 'denied' ? 'blocked' : 'ask';
}

export function useLivePage(): LivePageView {
  const { platform, showClaude, showCodex, withSrc, effectiveSource } = useSource();
  const { recent, recentHours, setRecentHours, weekly, liveWeekly, liveUsage, codexLive } = useLiveData();
  const { configData, modeKnown, isApi, weekStart, settings } = useConfigMode();
  const { costPerDay, coverageDays } = useCostMetrics();
  const { litellmActual } = useLiteLlmActual();
  const [caps] = usePlatformLimits();
  const limits = useLimits();

  const both = platform === 'both';
  const claudePlanMode = showClaude && modeKnown && !isApi;

  const accountsLive = usePolling<AccountsLiveData>(showClaude && !isApi ? '/api/accounts/live' : '', ACCOUNTS_POLL_MS);
  const codexBlock = usePolling<CodexBlock>(showCodex ? '/api/codex/block' : '', CODEX_BLOCK_POLL_MS);
  const codexApiKey = !!codexBlock.data?.apiKey;
  const codexPlanMode = showCodex && !codexApiKey;

  const scopeDrivers = !both && (platform === 'codex' ? codexPlanMode : claudePlanMode);
  const claudeDrivers = both && claudePlanMode;
  const codexDrivers = both && codexPlanMode;
  const scopeContrib = usePolling<ContributorsData>(scopeDrivers ? withSrc('/api/usage/contributors') : '', SLOW_POLL_MS);
  const claudeContrib = usePolling<ContributorsData>(claudeDrivers ? contributorsUrl('claude') : '', SLOW_POLL_MS);
  const codexContrib = usePolling<ContributorsData>(codexDrivers ? contributorsUrl('codex') : '', SLOW_POLL_MS);
  const hits = usePolling<LimitHitsData>(withSrc('/api/insights/limits?days=30'), SLOW_POLL_MS);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((count) => count + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const alertsOn = resolveLimitAlerts((settings as { limitAlerts?: unknown }).limitAlerts).mode !== 'off';
  const permission = alertPermission(alertsOn);

  const split = both ? weekly.data?.bySource : undefined;
  const claudeCostPerDay = split ? (split.code.cost + split.cowork.cost) / coverageDays : costPerDay;
  const codexCostPerDay = split ? split.codex.cost / coverageDays : costPerDay;
  const todayActual = litellmActual?.today ?? null;
  const claudeDailyCap = caps.claude.dailyLimit;
  const codexDailyCap = caps.codex?.dailyLimit ?? null;
  const block = recent.data?.activeBlock ?? null;
  const recentFailed = !recent.data && !!recent.error;

  const freshClaudeGauge = useMemo(
    () =>
      showClaude
        ? buildClaudeGauge({
            named: both,
            block,
            loading: recent.loading,
            failed: recentFailed,
            live: liveUsage.data,
            isApi,
            costPerDay: claudeCostPerDay,
            dailyLimit: claudeDailyCap,
            todayActualCost: todayActual,
            permission,
            now: Date.now(),
          })
        : null,
    [
      showClaude, both, block, recent.loading, recentFailed, liveUsage.data, isApi, claudeCostPerDay, claudeDailyCap,
      todayActual, permission, tick,
    ],
  );
  const claudeGauge = useStableView(freshClaudeGauge);

  const codexBlockData = codexBlock.data;
  const codexBlockLoading = !codexBlockData && codexBlock.loading;
  const codexBlockFailed = !codexBlockData && !!codexBlock.error;
  const freshCodexGauge = useMemo(
    () =>
      showCodex
        ? buildCodexGauge({
            named: both,
            block: codexBlockData,
            loading: codexBlockLoading,
            failed: codexBlockFailed,
            live: codexLive.data,
            liveFailed: codexLive.error,
            windowSec: codexBlockData?.windowSec ?? null,
            isApi: codexApiKey,
            costPerDay: codexCostPerDay,
            dailyLimit: codexDailyCap,
            permission,
            now: Date.now(),
          })
        : null,
    [
      showCodex, both, codexBlockData, codexBlockLoading, codexBlockFailed, codexLive.data, codexLive.error, codexApiKey,
      codexCostPerDay, codexDailyCap, permission, tick,
    ],
  );
  const codexGauge = useStableView(freshCodexGauge);

  const gauges = useMemo(
    () => [claudeGauge, codexGauge].filter((gauge): gauge is LimitGaugeView => gauge !== null),
    [claudeGauge, codexGauge],
  );

  const coworkOnly = effectiveSource === 'cowork';
  const freshHourly = useMemo(
    () =>
      buildHourly({
        recent: recent.data,
        loading: recent.loading,
        failed: !!recent.error,
        hours: recentHours,
        platform,
        coworkOnly,
      }),
    [recent.data, recent.loading, recent.error, recentHours, platform, coworkOnly],
  );
  const hourly = useStableView(freshHourly);

  const accounts = accountsLive.data?.accounts ?? NO_ACCOUNTS;
  const bySource = liveWeekly.data?.bySource;
  const claudeWeeklyEffective = !liveWeekly.data
    ? null
    : both && bySource
      ? bySource.code.effectiveTokens + bySource.cowork.effectiveTokens
      : liveWeekly.data.totals.effectiveTokens;
  const plan = configData?.subscriptionType ?? configData?.rateLimitTier ?? null;

  const freshClaudePlans = useMemo(
    () =>
      claudePlanMode
        ? buildClaudePlans({
            accounts,
            live: liveUsage.data,
            liveLoading: liveUsage.loading,
            block,
            weeklyEffective: claudeWeeklyEffective,
            plan,
            weekStart,
            now: Date.now(),
          })
        : NO_PLANS,
    [claudePlanMode, accounts, liveUsage.data, liveUsage.loading, block, claudeWeeklyEffective, plan, weekStart, tick],
  );
  const claudePlans = useStableView(freshClaudePlans);

  const freshCodexPlan = useMemo(
    () => (codexPlanMode ? buildCodexPlan({ live: codexLive.data, failed: codexLive.error, weekStart, now: Date.now() }) : null),
    [codexPlanMode, codexLive.data, codexLive.error, weekStart, tick],
  );
  const codexPlan = useStableView(freshCodexPlan);

  const plans = useMemo(() => (codexPlan ? [...claudePlans, codexPlan] : claudePlans), [claudePlans, codexPlan]);

  const extraUsage = claudePlanMode ? (liveUsage.data?.extra_usage ?? null) : null;
  const spend = liveUsage.data?.spend;
  const orgExtraUsage = !!configData?.hasExtraUsageEnabled;
  const creditsLive = codexPlanMode && codexLive.data && !codexLive.data.error ? codexLive.data : null;
  const extras = useMemo(() => {
    const cards: ExtraUsageView[] = [];
    if (extraUsage) cards.push(claudeExtraUsageView(extraUsage, spend, orgExtraUsage));
    const credits = creditsLive ? codexCreditsView(creditsLive) : null;
    if (credits) cards.push(credits);
    return cards;
  }, [extraUsage, spend, orgExtraUsage, creditsLive]);

  const [ranges, setRanges] = useState<Record<string, ContribRange>>({});
  const onContribRange = useCallback((key: string, range: ContribRange) => {
    setRanges((current) => ({ ...current, [key]: range }));
  }, []);

  const contributors = useMemo(() => {
    const cards: LimitContributorsView[] = [];
    if (claudeDrivers) {
      cards.push(
        buildContributors({
          key: 'claude',
          codex: false,
          scope: ` · ${PLATFORM_NOUN.claude}`,
          data: claudeContrib.data,
          failed: !!claudeContrib.error,
          range: ranges.claude ?? DEFAULT_RANGE,
        }),
      );
    }
    if (codexDrivers) {
      cards.push(
        buildContributors({
          key: 'codex',
          codex: true,
          scope: ` · ${PLATFORM_NOUN.codex}`,
          data: codexContrib.data,
          failed: !!codexContrib.error,
          range: ranges.codex ?? DEFAULT_RANGE,
        }),
      );
    }
    if (scopeDrivers) {
      cards.push(
        buildContributors({
          key: SCOPE_KEY,
          codex: platform === 'codex',
          scope: titleScope(platform),
          data: scopeContrib.data,
          failed: !!scopeContrib.error,
          range: ranges[SCOPE_KEY] ?? DEFAULT_RANGE,
        }),
      );
    }
    return cards;
  }, [
    claudeDrivers, codexDrivers, scopeDrivers, platform, ranges, claudeContrib.data, claudeContrib.error,
    codexContrib.data, codexContrib.error, scopeContrib.data, scopeContrib.error,
  ]);

  const freshLimitHits = useMemo(
    () => buildLimitHits({ data: hits.data, failed: !!hits.error, platform, now: Date.now() }),
    [hits.data, hits.error, platform, tick],
  );
  const limitHits = useStableView(freshLimitHits);

  const gatewayBill = platform === 'claude' && litellmActual !== null;
  const billToday = litellmActual?.today ?? 0;
  const billWeek = litellmActual?.week ?? 0;
  const billMonth = litellmActual?.month ?? 0;
  const actualNote = gatewayBill ? (litellmActual?.note ?? null) : null;
  const weeklyBuckets = liveWeekly.data?.buckets;
  const budget = useMemo(() => {
    if (!weeklyBuckets && !gatewayBill) return null;
    return buildBudgetRows({
      limits,
      buckets: weeklyBuckets,
      costPerDay,
      weekStart,
      actual: gatewayBill ? { today: billToday, week: billWeek, month: billMonth } : null,
      now: Date.now(),
    });
  }, [weeklyBuckets, gatewayBill, billToday, billWeek, billMonth, limits, costPerDay, weekStart, tick]);

  const apiMode = (showClaude && isApi) || (showCodex && codexApiKey);
  const capped = hasCaps(limits);
  const budgetFailed = !liveWeekly.data && !!liveWeekly.error;
  const freshSpendCaps = useMemo(
    () => buildSpendCaps({ platform, budget, failed: budgetFailed, apiMode, hasCaps: capped, actualNote, now: Date.now() }),
    [platform, budget, budgetFailed, apiMode, capped, actualNote],
  );
  const spendCaps = useStableView(freshSpendCaps);

  const onHoursChange = useCallback((value: string) => setRecentHours(Number(value)), [setRecentHours]);

  const limitsAnswered =
    (!showClaude || isApi || !!liveUsage.data || !!liveUsage.error) && (!showCodex || !!codexLive.data || !!codexLive.error);
  const windowSettled = limitsAnswered && gauges.every((gauge) => gauge.state?.kind !== 'loading');
  const plansSettled = limitsAnswered && plans.every((card) => card.state?.kind !== 'loading');

  return {
    both,
    hours: String(recentHours),
    hourOptions: HOUR_OPTIONS,
    onHoursChange,
    gauges,
    hourly,
    plans,
    extras,
    windowSettled,
    plansSettled,
    contributors,
    onContribRange,
    limitHits,
    spendCaps,
  };
}
