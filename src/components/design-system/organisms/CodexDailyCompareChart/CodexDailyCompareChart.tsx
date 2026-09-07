import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { ChartSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact } from '@/lib/format';
import type { CodexDailyCompareChartProps, CompareTooltipProps } from './types';
import { LOCAL_COLOR, SERVER_COLOR, compareTotals, mergeDaily } from './utils';

function CompareTooltip({ active, payload }: CompareTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const delta = row.server > 0 ? Math.round(((row.local - row.server) / row.server) * 100) : null;
  return (
    <ChartTooltip label={row.date} minWidth={170}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SERVER_COLOR }} />
            <span className="text-zinc-300">Server</span>
          </span>
          <span className="font-semibold text-zinc-100">{compact(row.server)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LOCAL_COLOR }} />
            <span className="text-zinc-300">Local rollouts</span>
          </span>
          <span className="font-semibold text-zinc-100">{compact(row.local)}</span>
        </div>
      </div>
      {delta !== null && (
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-xs">
          <span className="font-medium text-zinc-500">local vs server</span>
          <span className="font-semibold text-zinc-300">{delta >= 0 ? '+' : ''}{delta}%</span>
        </div>
      )}
    </ChartTooltip>
  );
}

/**
 * OpenAI's per-day Codex token count (authoritative, every device) next to what
 * the local rollouts add up to for the same day. The gap is expected: the server
 * counts mobile/web usage this machine never sees, and its days are UTC.
 */
export function CodexDailyCompareChart({ server, local, loading, days }: CodexDailyCompareChartProps) {
  const rows = useMemo(() => mergeDaily(server, local, days), [server, local, days]);
  const totals = useMemo(() => compareTotals(rows), [rows]);
  const hasData = rows.some((r) => r.server > 0 || r.local > 0);

  return (
    <Section
      title={`Server vs local · daily tokens · ${days}d`}
      help="OpenAI's own per-day token count for your account (UTC days, includes mobile and web Codex) beside the sum of the local rollouts on this machine (local-calendar days). Both are joined by date, so a day near midnight can land on different sides of the UTC boundary — expect small day-to-day shifts, and a local total a little below the server figure."
      right={
        hasData ? (
          <span className="text-xs tabular-nums text-zinc-500">
            server {compact(totals.server)} · local {compact(totals.local)}
            {totals.deltaPct !== null && (
              <span className="text-zinc-400"> · {totals.deltaPct >= 0 ? '+' : ''}{totals.deltaPct}%</span>
            )}
          </span>
        ) : undefined
      }
    >
      {hasData ? (
        <div className="w-full">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#26262f" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tickFormatter={(v) => compact(Number(v))}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CompareTooltip />} />
                <Bar dataKey="server" fill={SERVER_COLOR} radius={[3, 3, 0, 0]} maxBarSize={12} />
                <Bar dataKey="local" fill={LOCAL_COLOR} radius={[3, 3, 0, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 pl-[44px]">
            <LegendDot color={SERVER_COLOR} label="Server (OpenAI, all devices)" />
            <LegendDot color={LOCAL_COLOR} label="Local rollouts (this machine)" />
          </div>
        </div>
      ) : loading ? (
        <ChartSkeleton heightClass="h-[220px]" />
      ) : (
        <div className="flex h-24 items-center justify-center text-sm text-zinc-600">No daily data yet</div>
      )}
    </Section>
  );
}
