import { BlockGauge } from '@/components/design-system/organisms/BlockGauge/BlockGauge';
import { UsageBarChart } from '@/components/design-system/organisms/UsageBarChart/UsageBarChart';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { PlanUsage } from '@/components/design-system/molecules/PlanUsage/PlanUsage';
import { AccountsLivePanel } from '@/components/design-system/organisms/AccountsLivePanel/AccountsLivePanel';
import { ExtraUsageCard } from '@/components/design-system/molecules/ExtraUsageCard/ExtraUsageCard';
import { LimitsContributors } from '@/components/design-system/organisms/LimitsContributors/LimitsContributors';
import { AutoResumeCard } from '@/components/design-system/organisms/AutoResumeCard/AutoResumeCard';
import { SpendingLimits } from '@/components/design-system/molecules/SpendingLimits/SpendingLimits';
import { GaugeSkeleton, ChartSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { hourLabel } from '@/lib/format';
import { buildBudgetRows } from '@/lib/budget';
import { useLiveData } from '@/hooks/useLiveData';
import { useConfigMode } from '@/hooks/useConfigMode';
import { useCostMetrics } from '@/hooks/useCostMetrics';
import { useLiteLlmActual } from '@/hooks/useLiteLlmActual';
import { usePolling } from '@/hooks/usePolling';
import type { AccountsLiveData } from '@/types';
import type { LiveTabProps } from './types';

export function LiveTab({ limits }: LiveTabProps) {
  const { recent, weekly, liveUsage, recentHours, setRecentHours } = useLiveData();
  const { configData, isApi, weekStart } = useConfigMode();
  const { costPerDay } = useCostMetrics();
  const { litellmActual } = useLiteLlmActual();

  // Live plan/limits per logged-in account (only polled while the Live tab is
  // mounted). >1 account swaps the single card for the side-by-side panel; with
  // one account this stays empty and the dashboard is byte-identical to before.
  const accountsLive = usePolling<AccountsLiveData>('/api/accounts/live', 15000);
  const accounts = accountsLive.data?.accounts ?? [];
  const multiAccount = accounts.length > 1;

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

      {/* Subscription rate-limit bars — only meaningful with a plan. With more
          than one logged-in account, show each account's limits side-by-side. */}
      {configData && !isApi && (
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
      )}

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
