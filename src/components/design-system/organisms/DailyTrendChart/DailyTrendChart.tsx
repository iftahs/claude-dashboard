import { Section } from '@/components/design-system/molecules/Section/Section';
import { UsageBarChart } from '@/components/design-system/organisms/UsageBarChart/UsageBarChart';
import { ExportButton } from '@/components/design-system/molecules/ExportButton/ExportButton';
import { ChartSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { dayLabel, dayLabelWithYear } from '@/lib/format';
import type { DailyMetric, DailyTrendChartProps } from './types';
import { trendDelta, trendExport } from './utils';

// Every token figure here is effective tokens; the cache-read-inclusive total is tooltip-only.
export function DailyTrendChart({
  data,
  loading,
  weekDays,
  metric,
  onMetricChange,
  costPerDay,
  tokensPerDay,
  ai,
  scope = '',
}: DailyTrendChartProps) {
  const delta = trendDelta(data, metric);

  return (
    <Section
      title={`Last ${weekDays} days${scope} · daily ${metric} by model`}
      help="Daily effective tokens (input + output + cache writes; cheap cache reads are excluded and shown only in the tooltip) or estimated equivalent cost, stacked by model. The dotted segment past today is a projection from your recent daily average. Toggle tokens/cost on the right; change the window with the selector at the top."
      {...ai}
      right={
        <div className="flex items-center gap-3">
          {delta !== null && (
            <span className={`text-xs font-semibold ${delta >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs prev period
            </span>
          )}
          <ExportButton label="Export" getData={() => (data ? trendExport(data, weekDays) : null)} />
          {/* Metric Selector */}
          <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10 text-xs">
            {(['tokens', 'cost'] as const).map((m: DailyMetric) => (
              <button
                key={m}
                onClick={() => onMetricChange(m)}
                className={`px-2.5 py-1 uppercase font-semibold transition-colors ${
                  metric === m ? 'bg-clay-500/20 text-clay-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {data ? (
        <UsageBarChart
          buckets={data.buckets}
          labelFor={weekDays > 60 ? dayLabelWithYear : dayLabel}
          projectionCostPerDay={costPerDay}
          projectionTokensPerDay={tokensPerDay}
          metric={metric}
        />
      ) : loading ? (
        <ChartSkeleton />
      ) : null}
    </Section>
  );
}
