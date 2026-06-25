import { BlockGauge } from '@/components/design-system/organisms/BlockGauge/BlockGauge';
import { UsageBarChart } from '@/components/design-system/organisms/UsageBarChart/UsageBarChart';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { PlanUsage } from '@/components/design-system/molecules/PlanUsage/PlanUsage';
import { SpendingLimits } from '@/components/design-system/molecules/SpendingLimits/SpendingLimits';
import { GaugeSkeleton, ChartSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { hourLabel } from '@/lib/format';
import { useLiveData } from '@/hooks/useLiveData';
import { useConfigMode } from '@/hooks/useConfigMode';
import { useCostMetrics } from '@/hooks/useCostMetrics';
import { useLiteLlmActual } from '@/hooks/useLiteLlmActual';
import type { LiveTabProps } from './types';

export function LiveTab({ limits }: LiveTabProps) {
  const { recent, weekly, liveUsage, recentHours, setRecentHours } = useLiveData();
  const { configData, isApi } = useConfigMode();
  const { costPerDay } = useCostMetrics();
  const { litellmActual } = useLiteLlmActual();

  const block = recent.data?.activeBlock ?? null;
  const hasSpendingLimits =
    limits.dailyLimit != null || limits.weeklyLimit != null || limits.monthlyLimit != null;

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
  );
}
