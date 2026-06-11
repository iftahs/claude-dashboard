import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact } from '@/lib/format';
import type { ComplexityScatterProps, TooltipProps } from './types';

function ComplexityTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <ChartTooltip label={d.project} minWidth={160}>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Date</span>
          <span className="text-zinc-200">{d.date}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Turns</span>
          <span className="font-semibold text-zinc-200">{d.turns}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Tool calls</span>
          <span className="font-semibold text-zinc-200">{d.toolCalls}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Tokens</span>
          <span className="font-semibold text-zinc-200">{compact(d.effectiveTokens)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Subagents</span>
          <span className="font-semibold text-zinc-200">{d.subagents}</span>
        </div>
      </div>
    </ChartTooltip>
  );
}

export function ComplexityScatter({ data }: ComplexityScatterProps) {
  if (!data) {
    return <Skeleton className="h-[280px] w-full rounded" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-zinc-500">
        No session data in this window.
      </div>
    );
  }

  const maxSubagents = Math.max(1, ...data.map((d) => d.subagents));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#26262f" />
          <XAxis
            dataKey="toolCalls"
            name="Tool calls"
            type="number"
            tick={{ fill: '#71717a', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'tool calls', position: 'insideBottom', fill: '#52525b', fontSize: 10, offset: -2 }}
          />
          <YAxis
            dataKey="effectiveTokens"
            name="Tokens"
            type="number"
            tick={{ fill: '#71717a', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => compact(v)}
          />
          <ZAxis
            dataKey="subagents"
            range={[30, 30 + maxSubagents * 40]}
            name="Subagents"
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={<ComplexityTooltip />}
          />
          <Scatter
            data={data}
            fill="#d97757"
            fillOpacity={0.65}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
