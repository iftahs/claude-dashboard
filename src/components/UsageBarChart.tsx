import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Bucket } from '../types';
import { compact, shortModel, usd } from '../lib/format';
import { modelColor } from '../lib/palette';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
    payload: {
      label: string;
      cost: number;
      [key: string]: string | number;
    };
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const bucketCost = payload[0].payload.cost;
    const sortedPayload = [...payload]
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    const displayPayload = sortedPayload.length > 0 ? sortedPayload : payload;

    return (
      <div className="rounded-xl border border-white/10 bg-[#131318] p-3 shadow-2xl text-[12px] min-w-[150px]">
        <div className="mb-2 font-semibold text-zinc-400">{label}</div>
        <div className="space-y-1.5">
          {displayPayload.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: item.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-zinc-300">{shortModel(item.name)}</span>
              </span>
              <span className="font-semibold text-zinc-100">{compact(item.value)}</span>
            </div>
          ))}
        </div>
        {bucketCost !== undefined && (
          <div className="mt-2 border-t border-white/5 pt-2 flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-medium">Est. Cost</span>
            <span className="font-bold text-clay-400">{usd(bucketCost)}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
}

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
    const row: Record<string, number | string> = { label: labelFor(b.start), cost: b.cost };
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
            content={<CustomTooltip />}
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
