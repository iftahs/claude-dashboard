import { BlockGauge } from '@/components/design-system/organisms/BlockGauge/BlockGauge';
import { UsageBarChart } from '@/components/design-system/organisms/UsageBarChart/UsageBarChart';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { PlanUsage } from '@/components/design-system/molecules/PlanUsage/PlanUsage';
import { AccountsLivePanel } from '@/components/design-system/organisms/AccountsLivePanel/AccountsLivePanel';
import { ExtraUsageCard } from '@/components/design-system/molecules/ExtraUsageCard/ExtraUsageCard';
import { LimitsContributors } from '@/components/design-system/organisms/LimitsContributors/LimitsContributors';
import { AutoResumeCard } from '@/components/design-system/organisms/AutoResumeCard/AutoResumeCard';
import { SpendingLimits } from '@/components/design-system/molecules/SpendingLimits/SpendingLimits';
import { CodexPlanCard, CodexPlanStats } from '@/components/design-system/organisms/CodexPlanPanel/CodexPlanPanel';
import { CodexDailyCompareChart } from '@/components/design-system/organisms/CodexDailyCompareChart/CodexDailyCompareChart';
import { PlatformComparison } from '@/components/design-system/organisms/PlatformComparison/PlatformComparison';
import { GaugeSkeleton, ChartSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { hourLabel } from '@/lib/format';
import { buildBudgetRows } from '@/lib/budget';
import { useLiveData } from '@/hooks/useLiveData';
import { useConfigMode } from '@/hooks/useConfigMode';
import { useCostMetrics } from '@/hooks/useCostMetrics';
import { useLiteLlmActual } from '@/hooks/useLiteLlmActual';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import type { AccountsLiveData, ActivityData } from '@/types';
import type { LiveTabProps } from './types';

/** Window of the Codex server-vs-local comparison chart. */
const COMPARE_DAYS = 30;

/**
 * Hourly tokens by model for the recent window. Identical on every platform —
 * `recent` is already scoped by the header switcher (Claude / Codex / Both), and
 * the model colours keep the two families apart when both are shown.
 */
function HourlyChart() {
  const { recent, recentHours, setRecentHours } = useLiveData();
  return (
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
  );
}

export function LiveTab({ limits }: LiveTabProps) {
  const { platform, codexAvailable } = useSource();
  const { recent, weekly, weekDays, liveUsage, codexLive, codexProfile } = useLiveData();
  const { configData, isApi, weekStart } = useConfigMode();
  const { costPerDay } = useCostMetrics();
  const { litellmActual } = useLiteLlmActual();

  // Live plan/limits per logged-in account (only polled while the Live tab is
  // mounted). >1 account swaps the single card for the side-by-side panel; with
  // one account this stays empty and the dashboard is byte-identical to before.
  const accountsLive = usePolling<AccountsLiveData>('/api/accounts/live', 15000);
  const accounts = accountsLive.data?.accounts ?? [];
  const multiAccount = accounts.length > 1;

  // Local per-day Codex totals for the server-vs-local comparison. Scoped to
  // source=codex explicitly (not via withSrc) — that panel is Codex-only whatever
  // the header shows. Disabled (no request) unless a Codex panel is on screen.
  const codexActivity = usePolling<ActivityData>(
    codexAvailable && platform !== 'claude' ? `/api/activity?days=${COMPARE_DAYS}&source=codex` : '',
    60000,
  );

  const block = recent.data?.activeBlock ?? null;
  const hasSpendingLimits =
    limits.dailyLimit != null || limits.weeklyLimit != null || limits.monthlyLimit != null;

  const budgetRows = buildBudgetRows({
    limits,
    buckets: weekly.data?.buckets,
    costPerDay,
    weekStart,
    actual: litellmActual ?? null,
    now: Date.now(),
  });

  // The Claude rate-limit card — the same node under Claude and under Both.
  const claudePlanCard =
    configData && !isApi ? (
      multiAccount ? (
        <AccountsLivePanel accounts={accounts} weekStart={weekStart} />
      ) : (
        <PlanUsage
          block={block}
          weekly={weekly.data}
          liveUsage={liveUsage.data}
          weekStart={weekStart}
          tier={configData.subscriptionType ?? configData.rateLimitTier ?? null}
        />
      )
    ) : null;

  const codexCompareChart = (
    <CodexDailyCompareChart
      server={codexProfile.data?.dailyUsage ?? []}
      local={codexActivity.data?.dailyActivity ?? []}
      loading={codexProfile.loading || codexActivity.loading}
      days={COMPARE_DAYS}
    />
  );

  // ── Codex only ────────────────────────────────────────────────────────────
  // BlockGauge is Anthropic-specific (its alerts talk about the Claude block), so
  // the Codex rate-limit card takes its slot; everything Claude-only below it —
  // auto-resume, extra usage, limit contributors, accounts — is dropped.
  if (platform === 'codex') {
    return (
      <>
        {/* items-start, not items-stretch: the Codex card carries two bars where
            BlockGauge carries a donut, so stretching it to the chart's height
            would open a gap between its title and its bars. */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <CodexPlanCard live={codexLive} weekStart={weekStart} />
          <div className="flex flex-col lg:col-span-2">
            <HourlyChart />
          </div>
        </div>

        <CodexPlanStats live={codexLive} profile={codexProfile} />

        {codexCompareChart}

        {hasSpendingLimits && (
          <SpendingLimits rows={budgetRows} note={litellmActual?.note ?? 'estimated from local logs'} />
        )}

        <p className="text-xs leading-relaxed text-zinc-500">
          <span className="font-semibold text-zinc-400">What this covers:</span> the Codex rollouts the ChatGPT
          desktop app writes under <code className="font-mono text-zinc-400">~/.codex</code> — every thread run on
          this machine, with each turn&apos;s Guardian auto-review folded into its parent thread. Costs elsewhere in
          the dashboard are estimates at OpenAI&apos;s list API prices (a subscription has no per-token bill). Codex
          usage from the mobile and web apps never reaches this machine, so it appears only in the server series
          above.
        </p>
      </>
    );
  }

  // ── Both platforms ────────────────────────────────────────────────────────
  if (platform === 'both') {
    return (
      <>
        <PlatformComparison
          claudePlan={claudePlanCard}
          codexLive={codexLive}
          codexProfile={codexProfile}
          weekStart={weekStart}
          bySource={weekly.data?.bySource ?? null}
          byModel={weekly.data?.byModel ?? []}
          weekDays={weekDays}
          loading={weekly.loading}
        />

        <HourlyChart />

        {/* Claude-side panels — each self-hides when it has nothing to say. */}
        <AutoResumeCard />
        {configData && !isApi && liveUsage.data?.extra_usage && (
          <ExtraUsageCard
            extraUsage={liveUsage.data.extra_usage}
            spend={liveUsage.data.spend}
            orgEnabled={configData.hasExtraUsageEnabled}
          />
        )}
        {configData && !isApi && <LimitsContributors />}

        {codexCompareChart}

        {(isApi || hasSpendingLimits) && (
          <SpendingLimits
            rows={budgetRows}
            note={litellmActual?.note ?? 'estimated from local logs'}
            alwaysShow={isApi}
          />
        )}
      </>
    );
  }

  // ── Claude only — the original layout, unchanged ──────────────────────────
  return (
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
          <HourlyChart />
        </div>
      </div>

      {/* Subscription rate-limit bars — only meaningful with a plan. With more
          than one logged-in account, show each account's limits side-by-side. */}
      {claudePlanCard}

      {/* Auto-resume status — self-hides unless armed or recently fired. */}
      <AutoResumeCard />

      {/* Extra usage — Anthropic's "pay once you hit your plan limit" overage/credit pool. */}
      {configData && !isApi && liveUsage.data?.extra_usage && (
        <ExtraUsageCard
          extraUsage={liveUsage.data.extra_usage}
          spend={liveUsage.data.spend}
          orgEnabled={configData.hasExtraUsageEnabled}
        />
      )}

      {/* What's contributing to your limits usage? — cost-weighted Day/Week breakdown. */}
      {configData && !isApi && <LimitsContributors />}

      {/* Spend vs caps — always shown in API mode (the cost IS the bill);
          in subscription mode only when the user has configured caps. */}
      {(isApi || hasSpendingLimits) && (
        <SpendingLimits
          rows={budgetRows}
          note={litellmActual?.note ?? 'estimated from local logs'}
          alwaysShow={isApi}
        />
      )}
    </>
  );
}
