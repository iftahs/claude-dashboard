import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ModelShare } from '../types';
import { compact, shortModel } from '../lib/format';
import { modelColor } from '../lib/palette';

export function ModelBreakdown({ models }: { models: ModelShare[] }) {
  const data = models
    .filter((m) => m.totalTokens > 0)
    .map((m) => ({ name: m.model, value: m.totalTokens }));
  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-zinc-500">No usage yet</div>;
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2}>
              {data.map((d) => (
                <Cell key={d.name} fill={modelColor(d.name)} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#1b1b22',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [compact(value), shortModel(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-2">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: modelColor(d.name) }} />
              <span className="text-zinc-300">{shortModel(d.name)}</span>
            </span>
            <span className="tabular-nums text-zinc-400">
              {compact(d.value)} · {((d.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
