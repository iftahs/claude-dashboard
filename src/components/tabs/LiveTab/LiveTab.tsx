import { Fragment } from 'react';
import { BlockGauge } from '@/components/design-system/organisms/BlockGauge/BlockGauge';
import { UsageBarChart } from '@/components/design-system/organisms/UsageBarChart/UsageBarChart';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { PlanUsage } from '@/components/design-system/molecules/PlanUsage/PlanUsage';
import { AccountsLivePanel } from '@/components/design-system/organisms/AccountsLivePanel/AccountsLivePanel';
import { ExtraUsageCard } from '@/components/design-system/molecules/ExtraUsageCard/ExtraUsageCard';
import { claudeExtraUsageView, codexCreditsView } from '@/components/design-system/molecules/ExtraUsageCard/utils';
import { LimitsContributors } from '@/components/design-system/organisms/LimitsContributors/LimitsContributors';
import { LimitHits } from '@/components/design-system/organisms/LimitHits/LimitHits';
import { SpendingLimits } from '@/components/design-system/molecules/SpendingLimits/SpendingLimits';
import { CodexPlanCard } from '@/components/design-system/organisms/CodexPlanPanel/CodexPlanPanel';
import {
  codexGaugeLabels,
  codexGaugeLive,
  codexGaugeWindow,
} from '@/components/design-system/organisms/CodexPlanPanel/utils';
import { GaugeSkeleton, ChartSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { hourLabel } from '@/lib/format';
import { buildBudgetRows } from '@/lib/budget';
import { titleScope } from '@/lib/platform';
import { useLiveData } from '@/hooks/useLiveData';
import { useConfigMode } from '@/hooks/useConfigMode';
import { useCostMetrics } from '@/hooks/useCostMetrics';
import { useLiteLlmActual } from '@/hooks/useLiteLlmActual';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import type { AccountsLiveData, CodexBlock } from '@/types';
import type { ClaudeGaugeProps, CodexGaugeProps, LiveTabProps, SideBySideProps } from './types';

const FIVE_HOUR_SEC = 5 * 3600;

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

/** Claude's block: the live Claude.ai 5-hour % in the ring, the latest session's block in the rows. */
function ClaudeGauge({ costPerDay, dailyLimit, todayActualCost }: ClaudeGaugeProps) {
  const { recent, liveUsage } = useLiveData();
  const { isApi } = useConfigMode();
  if (recent.loading) return <GaugeSkeleton />;
  const lu = liveUsage.data;
  const live = lu && !lu.error && lu.five_hour ? { pct: lu.five_hour.utilization, resetsAt: lu.five_hour.resets_at } : null;
  return (
    <BlockGauge
      block={recent.data?.activeBlock ?? null}
      live={live}
      liveError={lu?.error ?? null}
      isApi={isApi}
      costPerDay={costPerDay}
      dailyLimit={dailyLimit}
      todayActualCost={todayActualCost}
    />
  );
}

/**
 * Codex's block: the ChatGPT plan window (5-hour, else weekly) in the ring and the
 * local Codex usage inside it in the rows. No block-limit guess — Codex publishes
 * no token ceiling, so offline the ring shows tokens, not an invented %.
 */
function CodexGauge({ block, costPerDay, dailyLimit }: CodexGaugeProps) {
  const { codexLive } = useLiveData();
  if (!block.data && block.loading) return <GaugeSkeleton />;
  const windowSec = block.data?.windowSec ?? codexGaugeWindow(codexLive.data)?.windowSec ?? FIVE_HOUR_SEC;
  return (
    <BlockGauge
      block={block.data}
      live={codexGaugeLive(codexLive.data)}
      liveError={codexLive.data?.error ?? codexLive.error ?? null}
      isApi={!!block.data?.apiKey}
      costPerDay={costPerDay}
      dailyLimit={dailyLimit}
      blockLimit={null}
      windowMs={windowSec * 1000}
      labels={codexGaugeLabels(codexLive.data, windowSec)}
    />
  );
}

/** One node per platform in a row (Both); a single node takes the full width. */
function SideBySide({ items }: SideBySideProps) {
  // Keyed by slot (Claude first, Codex second), so a card never remounts because the other one came or went.
  const shown = items.flatMap((node, slot) => (node ? [<Fragment key={slot}>{node}</Fragment>] : []));
  if (shown.length === 0) return null;
  if (shown.length === 1) return shown[0];
  return <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">{shown}</div>;
}

/**
 * The Live tab, one skeleton on every platform:
 *
 *   gauge row (BlockGauge | hourly chart) → plan usage → extra usage / credits →
 *   what's contributing to your limits → limit hits → spend vs caps
 *
 * Claude and Codex fill the same slots with their own data; under Both the
 * per-platform slots sit side by side (the two gauges share the first row and the
 * hourly chart, which already mixes both model families, gets its own).
 */
export function LiveTab({ limits }: LiveTabProps) {
  const { platform, showClaude, showCodex } = useSource();
  const { recent, weekly, liveWeekly, liveUsage, codexLive } = useLiveData();
  const { configData, isApi, weekStart } = useConfigMode();
  const { costPerDay, coverageDays } = useCostMetrics();
  const { litellmActual } = useLiteLlmActual();

  // Live plan/limits per logged-in account (only polled while the Live tab is
  // mounted, and not under Codex, where the Claude plan card never renders).
  // >1 account swaps the single card for the side-by-side panel; with one
  // account this stays empty and the dashboard is byte-identical to before.
  const accountsLive = usePolling<AccountsLiveData>(showClaude ? '/api/accounts/live' : '', 15000);
  const accounts = accountsLive.data?.accounts ?? [];
  const multiAccount = accounts.length > 1;

  // The Codex block is computed per request from the live window (not memoised),
  // so only this tab polls it.
  const codexBlock = usePolling<CodexBlock>(showCodex ? '/api/codex/block' : '', 5000);
  const codexApiKey = !!codexBlock.data?.apiKey;

  const hasSpendingLimits =
    limits.dailyLimit != null || limits.weeklyLimit != null || limits.monthlyLimit != null;

  // Per-platform $/day for the API-mode cap rings: under Both the Trends window
  // mixes both platforms, so split it by source.
  const split = platform === 'both' ? weekly.data?.bySource : undefined;
  const claudeCostPerDay = split ? (split.code.cost + split.cowork.cost) / coverageDays : costPerDay;
  const codexCostPerDay = split ? split.codex.cost / coverageDays : costPerDay;

  // The gateway's real bill is Anthropic spend: it replaces the estimate only when
  // the rows cover Claude alone.
  const budgetActual = platform === 'claude' ? litellmActual ?? null : null;
  const budgetRows = buildBudgetRows({
    limits,
    buckets: liveWeekly.data?.buckets,
    costPerDay,
    weekStart,
    actual: budgetActual,
    now: Date.now(),
  });

  // ── Per-platform slots ────────────────────────────────────────────────────
  const claudeGauge = showClaude && (
    <ClaudeGauge costPerDay={claudeCostPerDay} dailyLimit={limits.dailyLimit} todayActualCost={litellmActual?.today ?? null} />
  );
  const codexGauge = showCodex && (
    <CodexGauge block={codexBlock} costPerDay={codexCostPerDay} dailyLimit={limits.dailyLimit} />
  );

  // Subscription rate-limit bars — only meaningful with a plan. With more than one
  // logged-in account, show each account's limits side-by-side.
  const claudePlan =
    showClaude && configData && !isApi ? (
      multiAccount ? (
        <AccountsLivePanel accounts={accounts} weekStart={weekStart} />
      ) : (
        <PlanUsage
          block={recent.data?.activeBlock ?? null}
          weekly={liveWeekly.data}
          liveUsage={liveUsage.data}
          weekStart={weekStart}
          tier={configData.subscriptionType ?? configData.rateLimitTier ?? null}
        />
      )
    ) : null;
  const codexPlan = showCodex && !codexApiKey ? <CodexPlanCard live={codexLive} weekStart={weekStart} /> : null;

  // Paying beyond the plan: Anthropic's extra usage / ChatGPT credits.
  const extra = showClaude && configData && !isApi ? liveUsage.data?.extra_usage : null;
  const claudeExtra = extra ? (
    <ExtraUsageCard view={claudeExtraUsageView(extra, liveUsage.data?.spend, !!configData?.hasExtraUsageEnabled)} />
  ) : null;
  const credits = showCodex && !codexApiKey && codexLive.data && !codexLive.data.error ? codexCreditsView(codexLive.data) : null;
  const codexCredits = credits ? <ExtraUsageCard view={credits} /> : null;

  // What's driving each platform's limit usage (limits are per provider, so never mixed).
  const contributors =
    platform === 'both' ? (
      <SideBySide
        items={[
          configData && !isApi && <LimitsContributors source="claude" showEmpty />,
          !codexApiKey && <LimitsContributors source="codex" showEmpty />,
        ]}
      />
    ) : (platform === 'codex' ? !codexApiKey : configData && !isApi) ? (
      <LimitsContributors />
    ) : null;

  // Spend vs caps — always shown in API mode (the cost IS the bill); in
  // subscription mode only when the user has configured caps.
  const apiMode = (showClaude && isApi) || (showCodex && codexApiKey);
  const spendNote =
    budgetActual?.note ?? (platform === 'codex' ? 'estimated from local logs · OpenAI list prices' : 'estimated from local logs');

  return (
    <>
      {platform === 'both' ? (
        <>
          <SideBySide items={[claudeGauge, codexGauge]} />
          <HourlyChart />
        </>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          {claudeGauge || codexGauge}
          <div className="flex flex-col lg:col-span-2">
            <HourlyChart />
          </div>
        </div>
      )}

      <SideBySide items={[claudePlan, codexPlan]} />
      <SideBySide items={[claudeExtra, codexCredits]} />
      {contributors}
      <LimitHits />

      {(apiMode || hasSpendingLimits) && (
        <SpendingLimits
          rows={budgetRows}
          note={spendNote}
          alwaysShow={apiMode}
          titleSuffix={titleScope(platform)}
        />
      )}
    </>
  );
}
