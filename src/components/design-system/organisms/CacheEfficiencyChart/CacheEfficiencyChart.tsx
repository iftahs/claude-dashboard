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
import { compact } from '@/lib/format';
import type { CacheEfficiencyChartProps, TooltipProps } from './types';

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

export function CacheEfficiencyChart({ data }: CacheEfficiencyChartProps) {
  if (data.length === 0) return null;

  const avgHitRate = data.reduce((s, d) => s + d.hitRate, 0) / data.length;
  const maxHitRate = Math.max(...data.map((d) => d.hitRate));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
        <span>
          Avg hit rate:{' '}
          <span className="text-emerald-400 font-semibold">{avgHitRate.toFixed(1)}%</span>
        </span>
        <span>
          Peak:{' '}
          <span className="text-zinc-300 font-semibold">{maxHitRate.toFixed(1)}%</span>
        </span>
      </div>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26262f" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => v.slice(5)} // MM-DD
            />
            <YAxis
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              width={36}
            />
            <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
            <ReferenceLine
              y={avgHitRate}
              stroke="#10b981"
              strokeDasharray="4 3"
              strokeOpacity={0.4}
              label={{ value: `avg ${avgHitRate.toFixed(0)}%`, fill: '#10b981', fontSize: 9, position: 'insideTopRight' }}
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
