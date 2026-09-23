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
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { compact } from '@/lib/format';
import { MAX_DOT_AREA, PLATFORM_DOT_COLOR, PLATFORM_NAME, sizeLabel } from './utils';
import type { ComplexityScatterProps, TooltipProps } from './types';

function ComplexityTooltip({ active, payload, sizeLabel: size, showPlatform }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const rows: [string, string | number][] = [
    ...(showPlatform ? [['Platform', PLATFORM_NAME[d.platform]] as [string, string]] : []),
    ['Date', d.date],
    ['Turns', d.turns],
    ['Tool calls', d.toolCalls],
    ['Tokens', compact(d.effectiveTokens)],
    [size, d.subagents],
  ];
  return (
    <ChartTooltip label={d.project} minWidth={160}>
      <div className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <span className="text-zinc-400">{k}</span>
            <span className={k === 'Date' || k === 'Platform' ? 'text-zinc-200' : 'font-semibold text-zinc-200'}>{v}</span>
          </div>
        ))}
      </div>
    </ChartTooltip>
  );
}

export function ComplexityScatter({ data, platform }: ComplexityScatterProps) {
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

  const size = sizeLabel(platform);
  const split = platform === 'both';
  const maxSubagents = Math.max(1, ...data.map((d) => d.subagents));
  // Under Both, one series per platform so the two read apart; otherwise the one clay series.
  const series = split
    ? (['claude', 'codex'] as const)
        .map((p) => ({ key: p, points: data.filter((d) => d.platform === p), color: PLATFORM_DOT_COLOR[p] }))
        .filter((s) => s.points.length > 0)
    : [{ key: 'all', points: data, color: PLATFORM_DOT_COLOR.claude }];

  return (
    <div>
      {split && (
        <div className="mb-2 flex gap-4">
          {series.map((s) => (
            <LegendDot key={s.key} color={s.color} label={PLATFORM_NAME[s.key as 'claude' | 'codex']} />
          ))}
        </div>
      )}
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
              domain={[0, maxSubagents]}
              range={[30, Math.min(30 + maxSubagents * 40, MAX_DOT_AREA)]}
              name={size}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={<ComplexityTooltip sizeLabel={size} showPlatform={split} />}
            />
            {series.map((s) => (
              <Scatter key={s.key} data={s.points} fill={s.color} fillOpacity={0.65} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
