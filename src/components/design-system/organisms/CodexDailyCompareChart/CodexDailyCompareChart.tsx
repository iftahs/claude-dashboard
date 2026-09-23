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
    <ChartTooltip label={`${row.date} (UTC)`} minWidth={170}>
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
 * the local rollouts add up to for the same day — both in UTC days and both in
 * all tokens (cached input included), so the bars are directly comparable. The
 * gap that remains is real: the server counts mobile/web usage this machine never
 * sees. Lives on Trends in the slot where the Claude platform shows the LiteLLM
 * "Actual billed" card — each platform's server-side figure beside the estimate.
 */
export function CodexDailyCompareChart({ server, local, loading, days }: CodexDailyCompareChartProps) {
  const rows = useMemo(() => mergeDaily(server, local, days), [server, local, days]);
  const totals = useMemo(() => compareTotals(rows), [rows]);
  const hasData = rows.some((r) => r.server > 0 || r.local > 0);

  return (
    <Section
      title={`Server vs local · Codex · daily tokens · ${days}d`}
      help="OpenAI's own per-day token count for your account (includes mobile and web Codex) beside the sum of the local rollouts on this machine. Both series are UTC days and count every token, cached input included, so each pair of bars measures the same thing; expect the local bar at or a little below the server one (other devices), and the newest server day to lag while OpenAI catches up."
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
                {/* Long windows re-animate hundreds of bars on every poll. */}
                <Bar dataKey="server" fill={SERVER_COLOR} radius={[3, 3, 0, 0]} maxBarSize={12} isAnimationActive={rows.length <= 60} />
                <Bar dataKey="local" fill={LOCAL_COLOR} radius={[3, 3, 0, 0]} maxBarSize={12} isAnimationActive={rows.length <= 60} />
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
