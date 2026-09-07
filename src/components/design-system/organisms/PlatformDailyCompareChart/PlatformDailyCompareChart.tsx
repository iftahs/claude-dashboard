import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { ToggleGroup } from '@/components/design-system/atoms/ToggleGroup/ToggleGroup';
import { ChartSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact, usd } from '@/lib/format';
import type { DailyMetric } from '@/components/design-system/organisms/DailyTrendChart/types';
import type { CompareRow, CompareTooltipProps, PlatformDailyCompareChartProps } from './types';
import { CLAUDE_COLOR, CODEX_COLOR, mergePlatformDaily, platformTotals } from './utils';

const METRIC_OPTIONS: { value: DailyMetric; label: string }[] = [
  { value: 'tokens', label: 'tokens' },
  { value: 'cost', label: 'cost' },
];

const fmt = (v: number, metric: DailyMetric) => (metric === 'cost' ? usd(v) : compact(v));

function CompareTooltip({ active, payload, metric = 'tokens' }: CompareTooltipProps) {
  if (!active || !payload?.length) return null;
  const row: CompareRow = payload[0].payload;
  const total = row.claude + row.codex;
  return (
    <ChartTooltip label={row.label} minWidth={180}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CLAUDE_COLOR }} />
            <span className="text-zinc-300">Claude</span>
          </span>
          <span className="font-semibold text-zinc-100">{fmt(row.claude, metric)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CODEX_COLOR }} />
            <span className="text-zinc-300">Codex</span>
          </span>
          <span className="font-semibold text-zinc-100">{fmt(row.codex, metric)}</span>
        </div>
      </div>
      {total > 0 && (
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-xs">
          <span className="font-medium text-zinc-500">Codex share</span>
          <span className="font-semibold text-zinc-300">{Math.round((row.codex / total) * 100)}%</span>
        </div>
      )}
    </ChartTooltip>
  );
}

/**
 * Claude (Code + Cowork) beside Codex (ChatGPT desktop), day by day, for the
 * selected Trends window. Shown only under the *Both* platform — the two series
 * come from two explicit per-platform `/api/usage/weekly` polls rather than the
 * shared, platform-scoped one, because the point of the chart is the comparison
 * the scoped poll deliberately collapses.
 *
 * Both figures are effective tokens (or estimated equivalent API cost) — neither
 * subscription bills per token, and the two vendors' rate cards differ, so the
 * cost view compares list-price equivalents, not money actually spent.
 */
export function PlatformDailyCompareChart({
  claude,
  codex,
  loading,
  weekDays,
  metric,
  onMetricChange,
}: PlatformDailyCompareChartProps) {
  const rows = useMemo(() => mergePlatformDaily(claude, codex, metric), [claude, codex, metric]);
  const totals = useMemo(() => platformTotals(claude, codex, metric), [claude, codex, metric]);
  const hasData = rows.some((r) => r.claude > 0 || r.codex > 0);

  return (
    <Section
      title={`Claude vs Codex · daily ${metric} · ${weekDays}d`}
      help="Per-day effective tokens (or estimated equivalent API cost) for Claude — Claude Code plus Cowork — beside Codex in the ChatGPT desktop app, over the selected window. Cost is each vendor's own list-price equivalent, so the two bars are comparable in size but neither is a real bill."
      right={
        <div className="flex items-center gap-3">
          {hasData && (
            <span className="text-xs tabular-nums text-zinc-500">
              Claude {fmt(totals.claude, metric)} · Codex {fmt(totals.codex, metric)}
              {totals.codexSharePct !== null && (
                <span className="text-zinc-400"> · {totals.codexSharePct}% Codex</span>
              )}
            </span>
          )}
          <ToggleGroup<DailyMetric>
            options={METRIC_OPTIONS}
            value={metric}
            onChange={onMetricChange}
            uppercase
          />
        </div>
      }
    >
      {hasData ? (
        <div className="w-full">
          <div className="h-[240px] w-full">
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
                  tickFormatter={(v) => fmt(Number(v), metric)}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={metric === 'cost' ? 56 : 44}
                />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CompareTooltip metric={metric} />} />
                <Bar dataKey="claude" fill={CLAUDE_COLOR} radius={[3, 3, 0, 0]} maxBarSize={12} />
                <Bar dataKey="codex" fill={CODEX_COLOR} radius={[3, 3, 0, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 pl-[44px]">
            <LegendDot color={CLAUDE_COLOR} label="Claude (Code + Cowork)" size="sm" />
            <LegendDot color={CODEX_COLOR} label="Codex (ChatGPT desktop)" size="sm" />
          </div>
        </div>
      ) : loading ? (
        <ChartSkeleton heightClass="h-[240px]" />
      ) : (
        <div className="flex h-24 items-center justify-center text-sm text-zinc-600">No usage in this window</div>
      )}
    </Section>
  );
}
