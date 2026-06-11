import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact } from '@/lib/format';
import type { ErrorBreakdownProps, TooltipProps } from './types';

function TrendTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <ChartTooltip label={d.date} minWidth={140}>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Calls</span>
          <span className="font-semibold text-zinc-200">{compact(d.calls)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Errors</span>
          <span className="font-semibold text-red-400">{compact(d.errors)}</span>
        </div>
      </div>
    </ChartTooltip>
  );
}

export function ErrorBreakdown({ data }: ErrorBreakdownProps) {
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-48 rounded" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full rounded" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full rounded" />
            ))}
          </div>
        </div>
        <Skeleton className="h-[120px] w-full rounded" />
      </div>
    );
  }

  const { totalCalls, errors, errorRate, categories, perTool, trend } = data;
  const maxCatCount = Math.max(1, ...Object.values(categories));
  const maxToolCalls = Math.max(1, ...perTool.map((t) => t.calls));

  return (
    <div className="space-y-5">
      {/* Summary line */}
      <div className="text-sm text-zinc-400">
        <span className="text-2xl font-bold tabular-nums text-red-400">
          {(errorRate * 100).toFixed(1)}%
        </span>{' '}
        error rate &mdash;{' '}
        <span className="text-zinc-200">{compact(errors)}</span> errors out of{' '}
        <span className="text-zinc-200">{compact(totalCalls)}</span> tool calls
      </div>

      {/* Categories + per-tool table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Error categories */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            By category
          </div>
          <div className="space-y-2.5">
            {Object.entries(categories)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs text-zinc-400 capitalize">
                    {cat.replace(/-/g, ' ')}
                  </span>
                  <ProgressBar pct={(count / maxCatCount) * 100} variant="default" />
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-300">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Per-tool table */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            By tool
          </div>
          <div className="space-y-2">
            {perTool.map((t) => {
              const rateColor =
                t.errorRate > 0.1
                  ? 'text-red-400'
                  : t.errorRate > 0.05
                  ? 'text-amber-400'
                  : 'text-zinc-400';
              return (
                <div key={t.name} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 truncate text-zinc-400" title={t.name}>
                    {t.name}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-600">
                    <div
                      className="h-full rounded-full bg-clay-500/60"
                      style={{ width: `${(t.calls / maxToolCalls) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right tabular-nums text-zinc-400">
                    {compact(t.calls)}
                  </span>
                  <span className={`w-10 shrink-0 text-right tabular-nums font-semibold ${rateColor}`}>
                    {(t.errorRate * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Trend line chart */}
      {trend.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Errors per day
          </div>
          <div className="h-[120px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26262f" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.05)' }} content={<TrendTooltip />} />
                <Line
                  type="monotone"
                  dataKey="errors"
                  stroke="#f87171"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f87171', stroke: '#131318', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
