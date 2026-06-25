import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { compact, shortModel, usd } from '@/lib/format';
import { modelColor } from '@/lib/palette';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import type { ModelBreakdownProps } from './types';

export function ModelBreakdown({ models }: ModelBreakdownProps) {
  const data = models
    .filter((m) => m.totalTokens > 0)
    .map((m) => ({ name: m.model, value: m.totalTokens }));
  const total = data.reduce((s, d) => s + d.value, 0);

  // Cost efficiency: cost per 1M effective tokens per model
  const efficiencyData = models
    .filter((m) => m.effectiveTokens > 0 && m.cost > 0)
    .map((m) => ({
      name: m.model,
      costPer1M: (m.cost / m.effectiveTokens) * 1_000_000,
    }))
    .sort((a, b) => a.costPer1M - b.costPer1M); // cheapest first

  const maxCostPer1M = Math.max(...efficiencyData.map((d) => d.costPer1M), 1);

  if (data.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-zinc-500">No usage yet</div>;
  }

  return (
    <div className="space-y-5">
      {/* Donut + legend */}
      <div className="flex items-center gap-4">
        <div className="h-[200px] w-[200px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart style={{ background: 'transparent' }}>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} stroke="#131318" strokeWidth={2}>
                {data.map((d) => (
                  <Cell key={d.name} fill={modelColor(d.name)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1b1b22',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                itemStyle={{ color: '#e4e4e7' }}
                labelStyle={{ color: '#e4e4e7' }}
                formatter={(value: number, name: string) => [compact(value), shortModel(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-2">
          {data.map((d) => (
            <li key={d.name} className="flex items-center justify-between text-sm">
              <LegendDot
                color={modelColor(d.name)}
                label={shortModel(d.name)}
                size="md"
                labelClassName="text-zinc-300"
              />
              <span className="tabular-nums text-zinc-400">
                {compact(d.value)} · {((d.value / total) * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Cost efficiency bars */}
      {efficiencyData.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-white/10">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
            Cost per 1M effective tokens
          </div>
          {efficiencyData.map((d) => {
            const pct = (d.costPer1M / maxCostPer1M) * 100;
            return (
              <div key={d.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    {/* h-1.5 w-1.5 dot has no matching LegendDot size — keep inline */}
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: modelColor(d.name) }} />
                    <span className="text-zinc-300">{shortModel(d.name)}</span>
                  </span>
                  <span className="font-mono text-zinc-400">{usd(d.costPer1M)} / 1M</span>
                </div>
                <ProgressBar pct={pct} color={modelColor(d.name)} height="sm" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
