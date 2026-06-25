import { Section } from '@/components/design-system/molecules/Section/Section';
import { UsageBarChart } from '@/components/design-system/organisms/UsageBarChart/UsageBarChart';
import { ExportButton } from '@/components/design-system/molecules/ExportButton/ExportButton';
import { ChartSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { dayLabel } from '@/lib/format';
import type { DailyMetric, DailyTrendChartProps } from './types';
import { trendDelta, trendExport } from './utils';

/**
 * Daily tokens (or equivalent cost), stacked by model, with a dotted projection
 * past today, a vs-prev-period delta, CSV/JSON export, and a tokens/cost toggle.
 */
export function DailyTrendChart({
  data,
  loading,
  weekDays,
  metric,
  onMetricChange,
  costPerDay,
  ai,
}: DailyTrendChartProps) {
  const delta = trendDelta(data, metric);

  return (
    <Section
      title={`Last ${weekDays} days · daily ${metric} by model`}
      help="Daily tokens (or equivalent cost), stacked by model. The dotted segment past today is a projection from your recent daily average. Toggle tokens/cost on the right; change the window with the selector at the top."
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
          labelFor={dayLabel}
          projectionCostPerDay={costPerDay}
          metric={metric}
        />
      ) : loading ? (
        <ChartSkeleton />
      ) : null}
    </Section>
  );
}
