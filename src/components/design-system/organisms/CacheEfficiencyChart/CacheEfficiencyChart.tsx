import { useMemo } from 'react';
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { compact } from '@/lib/format';
import type { CacheEfficiencyChartProps, CacheEfficiencyPoint, CacheSeries, CompareTooltipProps, TooltipProps } from './types';
import { avgHitRate, mergeCacheSeries } from './utils';

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <ChartTooltip label={d.date} minWidth={160}>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Cache hit rate</span>
          <span className="font-semibold text-emerald-400">{d.hitRate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Cache reads</span>
          <span className="font-semibold text-zinc-200">{compact(d.cacheReadTokens)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Total tokens</span>
          <span className="font-semibold text-zinc-200">{compact(d.totalTokens)}</span>
        </div>
      </div>
    </ChartTooltip>
  );
}

function CompareTooltip({ active, payload, series, points }: CompareTooltipProps) {
  if (!active || !payload?.length) return null;
  const date = payload[0].payload.date;
  return (
    <ChartTooltip label={date} minWidth={190}>
      <div className="space-y-2">
        {series.map((s) => {
          const p = points.get(s.key)?.get(date);
          return (
            <div key={s.key} className="space-y-0.5">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-zinc-300">{s.label}</span>
                </span>
                <span className="font-semibold text-zinc-100">{p ? `${p.hitRate.toFixed(1)}%` : '—'}</span>
              </div>
              {p && (
                <div className="flex justify-between gap-4 pl-3 text-[11px] text-zinc-500">
                  <span>cache reads / all tokens</span>
                  <span className="tabular-nums">
                    {compact(p.cacheReadTokens)} / {compact(p.totalTokens)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ChartTooltip>
  );
}

const axisTick = { fill: '#71717a', fontSize: 10 };

function SingleSeries({ data }: { data: CacheEfficiencyPoint[] }) {
  const avg = avgHitRate(data);
  const maxHitRate = Math.max(...data.map((d) => d.hitRate));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
        <span>
          Avg hit rate: <span className="text-emerald-400 font-semibold">{avg.toFixed(1)}%</span>
        </span>
        <span>
          Peak: <span className="text-zinc-300 font-semibold">{maxHitRate.toFixed(1)}%</span>
        </span>
      </div>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26262f" vertical={false} />
            <XAxis
              dataKey="date"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => v.slice(5)} // MM-DD
            />
            <YAxis
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              width={36}
            />
            <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
            <ReferenceLine
              y={avg}
              stroke="#10b981"
              strokeDasharray="4 3"
              strokeOpacity={0.4}
              label={{ value: `avg ${avg.toFixed(0)}%`, fill: '#10b981', fontSize: 9, position: 'insideTopRight' }}
            />
            <Line
              type="monotone"
              dataKey="hitRate"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#10b981', stroke: '#131318', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** One line per platform (the *Both* view) — the two vendors cache differently, so a pooled rate describes neither. */
function MultiSeries({ series }: { series: CacheSeries[] }) {
  const { rows, points } = useMemo(() => mergeCacheSeries(series), [series]);
  const shown = series.filter((s) => s.points.length > 0);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 mb-1">
        <span>Avg hit rate:</span>
        {shown.map((s) => (
          <span key={s.key}>
            {s.label} <span className="font-semibold text-zinc-300">{avgHitRate(s.points).toFixed(1)}%</span>
          </span>
        ))}
      </div>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26262f" vertical={false} />
            <XAxis
              dataKey="date"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => v.slice(5)} // MM-DD
            />
            <YAxis
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.05)' }}
              content={<CompareTooltip series={shown} points={points} />}
            />
            {shown.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 4, fill: s.color, stroke: '#131318', strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pl-[36px]">
        {shown.map((s) => (
          <LegendDot key={s.key} color={s.color} label={s.label} size="sm" />
        ))}
      </div>
    </div>
  );
}

export function CacheEfficiencyChart({ data, series }: CacheEfficiencyChartProps) {
  if (series && series.filter((s) => s.points.length > 0).length >= 2) return <MultiSeries series={series} />;
  const single = data ?? series?.find((s) => s.points.length > 0)?.points ?? [];
  if (single.length === 0) return null;
  return <SingleSeries data={single} />;
}
