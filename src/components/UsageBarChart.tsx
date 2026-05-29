import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Bucket } from '../types';
import { compact, shortModel } from '../lib/format';
import { modelColor } from '../lib/palette';

export function UsageBarChart({
  buckets,
  labelFor,
}: {
  buckets: Bucket[];
  labelFor: (ms: number) => string;
}) {
  const models = new Set<string>();
  for (const b of buckets)
    for (const m of Object.keys(b.byModel)) if (m !== '<synthetic>') models.add(m);
  const modelList = [...models];

  const data = buckets.map((b) => {
    const row: Record<string, number | string> = { label: labelFor(b.start) };
    for (const m of modelList) row[m] = b.byModel[m] ?? 0;
    return row;
  });

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#26262f" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => compact(Number(v))}
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            wrapperStyle={{ outline: 'none' }}
            contentStyle={{
              background: '#131318',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              fontSize: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            labelStyle={{ color: '#a1a1aa', marginBottom: 4 }}
            itemStyle={{ color: '#e4e4e7' }}
            formatter={(value: number, name: string) => [compact(value), shortModel(name)]}
          />
          {modelList.map((m, i) => (
            <Bar
              key={m}
              dataKey={m}
              stackId="t"
              fill={modelColor(m)}
              radius={i === modelList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
