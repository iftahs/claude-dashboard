import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact } from '@/lib/format';
import { LATENCY_COLOR, formatActive, formatDuration, latencyTiles } from './utils';
import type { HistogramTooltipProps, TurnLatencyProps } from './types';

function HistogramTooltip({ active, payload, split }: HistogramTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const rows: [string, number, string][] = split
    ? [['Claude', d.claude, LATENCY_COLOR.claude], ['Codex', d.codex, LATENCY_COLOR.codex]]
    : [['Turns', d.total, LATENCY_COLOR.claude]];
  return (
    <ChartTooltip label={d.label} minWidth={130}>
      <div className="space-y-1">
        {rows.map(([k, v, color]) => (
          <div key={k} className="flex items-center justify-between gap-4">
            {split ? <LegendDot color={color} label={k} /> : <span className="text-zinc-400">{k}</span>}
            <span className="font-semibold text-zinc-200">{compact(v)}</span>
          </div>
        ))}
      </div>
    </ChartTooltip>
  );
}

// Under Both, stats split per platform and the histogram stacks Claude over Codex.
export function TurnLatency({ data, platform }: TurnLatencyProps) {
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded" />
          ))}
        </div>
        <Skeleton className="h-[160px] w-full rounded" />
      </div>
    );
  }

  if (data.turns === 0) {
    return <div className="text-sm text-zinc-500">No completed turns in this window.</div>;
  }

  const split = platform === 'both';
  const platforms = (['claude', 'codex'] as const).filter((p) => data.byPlatform[p]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-2">
        {split ? (
          <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
            <div className="grid grid-cols-5 gap-2 bg-ink-800/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              <span className="col-span-2">Platform</span>
              <span className="text-right">Median</span>
              <span className="text-right">p90</span>
              <span className="text-right">1st token</span>
            </div>
            {platforms.map((p) => {
              const s = data.byPlatform[p]!;
              return (
                <div key={p} className="grid grid-cols-5 gap-2 border-t border-white/5 px-3 py-2 text-xs tabular-nums">
                  <span className="col-span-2 flex items-center gap-2">
                    <LegendDot color={LATENCY_COLOR[p]} label={p === 'claude' ? 'Claude' : 'Codex'} />
                    <span className="text-zinc-600">{compact(s.turns)}</span>
                  </span>
                  <span className="text-right text-zinc-200">{formatDuration(s.medianMs)}</span>
                  <span className="text-right text-zinc-300">{formatDuration(s.p90Ms)}</span>
                  <span className="text-right text-zinc-300">{formatDuration(s.medianTtftMs)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {latencyTiles(data).map((t) => (
              <div key={t.label} className="rounded-xl bg-ink-800/50 p-3 ring-1 ring-white/10">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  {t.label}
                  <InfoTip text={t.help} />
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums text-zinc-200">{t.value}</div>
              </div>
            ))}
          </div>
        )}
        <div className="text-xs text-zinc-500">
          <span className="font-semibold text-zinc-300">{compact(data.turns)}</span> turns ·{' '}
          <span className="font-semibold text-zinc-300">{formatActive(data.activeMs)}</span> active
        </div>
      </div>

      <div className="lg:col-span-3">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <span>Turns by duration</span>
          {split && (
            <span className="flex gap-3 font-normal normal-case tracking-normal">
              <LegendDot color={LATENCY_COLOR.claude} label="Claude" />
              <LegendDot color={LATENCY_COLOR.codex} label="Codex" />
            </span>
          )}
        </div>
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.histogram} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26262f" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<HistogramTooltip split={split} />} />
              {split ? (
                <>
                  <Bar dataKey="claude" stackId="t" fill={LATENCY_COLOR.claude} />
                  <Bar dataKey="codex" stackId="t" fill={LATENCY_COLOR.codex} radius={[3, 3, 0, 0]} />
                </>
              ) : (
                <Bar dataKey="total" fill={LATENCY_COLOR.claude} radius={[3, 3, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
