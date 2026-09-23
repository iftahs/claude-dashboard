import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact, toolLabel } from '@/lib/format';
import { categoryLabel, rateColor } from './utils';
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
          <span className="text-zinc-400">Failed</span>
          <span className="font-semibold text-red-400">{compact(d.errors)}</span>
        </div>
      </div>
    </ChartTooltip>
  );
}

// Failure rate is the Insights KPI row's to show — no rate hero here.
export function ErrorBreakdown({ data }: ErrorBreakdownProps) {
  if (!data) {
    return (
      <div className="space-y-4">
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

  const { errors, categories, perTool, perToolTotal, trend } = data;
  if (errors === 0) {
    return <div className="text-sm text-zinc-500">No failed tool calls in this window.</div>;
  }
  const maxCatCount = Math.max(1, ...Object.values(categories));
  const maxToolErrors = Math.max(1, ...perTool.map((t) => t.errors));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            By category
          </div>
          <div className="space-y-2.5">
            {Object.entries(categories)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs text-zinc-400" title={cat}>
                    {categoryLabel(cat)}
                  </span>
                  <ProgressBar pct={(count / maxCatCount) * 100} variant="default" />
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-300">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <span>By tool</span>
            {perToolTotal > perTool.length && (
              <span className="font-normal normal-case tracking-normal text-zinc-600">
                top {perTool.length} of {perToolTotal}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {perTool.map((t) => (
              <div key={t.name} className="flex items-center gap-2 text-xs">
                <span className="w-36 shrink-0 truncate text-zinc-400" title={t.name}>
                  {toolLabel(t.name)}
                </span>
                <ProgressBar pct={(t.errors / maxToolErrors) * 100} color="#f87171" className="flex-1" />
                <span className="w-16 shrink-0 text-right tabular-nums text-zinc-400">
                  {compact(t.errors)}
                  <span className="text-zinc-600">/{compact(t.calls)}</span>
                </span>
                <span className={`w-10 shrink-0 text-right tabular-nums font-semibold ${rateColor(t.errorRate)}`}>
                  {(t.errorRate * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trend line chart */}
      {trend.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Failures per day
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

      <div className="text-[10px] text-zinc-600">
        Failed calls only — declined or denied calls never ran, and are counted under Rejections.
      </div>
    </div>
  );
}
