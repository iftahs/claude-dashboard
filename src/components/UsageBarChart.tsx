import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
      isProjected?: boolean;
      [key: string]: string | number | boolean | undefined;
    };
  }>;
  label?: string;
  metric?: 'tokens' | 'cost';
}

function CustomTooltip({ active, payload, label, metric = 'tokens' }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const bucketCost = payload[0].payload.cost;
    const isProjected = payload[0].payload.isProjected;
    const sortedPayload = [...payload]
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    const displayPayload = sortedPayload.length > 0 ? sortedPayload : payload;

    return (
      <div className="rounded-xl border border-white/10 bg-[#131318] p-3 shadow-2xl text-[12px] min-w-[150px]">
        <div className="mb-2 font-semibold text-zinc-400 flex items-center gap-1.5">
          {label}
          {isProjected && (
            <span className="text-[10px] text-zinc-600 font-normal rounded-full bg-ink-600 px-1.5 py-0.5">projected</span>
          )}
        </div>
        <div className="space-y-1.5">
          {displayPayload.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: item.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-zinc-300">{shortModel(item.name)}</span>
              </span>
              <span className="font-semibold text-zinc-100">
                {metric === 'cost' || item.name === '__projected__' ? usd(item.value) : compact(item.value)}
              </span>
            </div>
          ))}
        </div>
        {metric !== 'cost' && bucketCost !== undefined && (
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
  projectionCostPerDay,
  metric = 'tokens',
}: {
  buckets: Bucket[];
  labelFor: (ms: number) => string;
  /** When provided, renders projected future bars for the remainder of the current month */
  projectionCostPerDay?: number;
  metric?: 'tokens' | 'cost';
}) {
  const models = new Set<string>();
  for (const b of buckets)
    for (const m of Object.keys(b.byModel)) if (m !== '<synthetic>') models.add(m);
  const modelList = [...models];

  const now = Date.now();
  const DAY = 86_400_000;

  const data = buckets.map((b) => {
    const row: Record<string, number | string | boolean> = { label: labelFor(b.start), cost: b.cost };
    for (const m of modelList) {
      row[m] = metric === 'cost' ? (b.byModelCost?.[m] ?? 0) : (b.byModel[m] ?? 0);
    }
    // Mark future buckets for the tooltip
    if (b.start > now) row.isProjected = true;
    return row;
  });

  // Add projected bars for remaining days in current month
  if (projectionCostPerDay && projectionCostPerDay > 0 && buckets.length > 0) {
    const lastBucket = buckets[buckets.length - 1];
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1, 1);
    endOfMonth.setHours(0, 0, 0, 0);
    const endOfMonthMs = endOfMonth.getTime();

    // Only add if the last bucket is the current day
    if (Math.abs(lastBucket.start - now) < 2 * DAY) {
      let t = lastBucket.start + DAY;
      
      // Compute tokens projection based on average daily effective tokens
      const avgTokensPerDay = buckets.reduce((acc, curr) => acc + curr.effectiveTokens, 0) / buckets.length;

      while (t < endOfMonthMs) {
        const projRow: Record<string, number | string | boolean> = {
          label: labelFor(t),
          cost: projectionCostPerDay,
          isProjected: true,
        };
        // No model breakdown for projections — show as a single "projected" bar
        projRow['__projected__'] = metric === 'cost' ? projectionCostPerDay : avgTokensPerDay;
        data.push(projRow);
        t += DAY;
      }
    }
  }

  const hasProjection = data.some((d) => d.isProjected);
  const allModelList = hasProjection ? [...modelList, '__projected__'] : modelList;

  // Today reference line label
  const todayLabel = labelFor(now);

  return (
    <div className="w-full">
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26262f" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => metric === 'cost' ? usd(Number(v)) : compact(Number(v))}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={metric === 'cost' ? 56 : 44}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              content={<CustomTooltip metric={metric} />}
            />
            {hasProjection && (
              <ReferenceLine
                x={todayLabel}
                stroke="#d97757"
                strokeDasharray="4 3"
                strokeOpacity={0.5}
                label={{ value: 'today', fill: '#d97757', fontSize: 10, position: 'insideTopRight' }}
              />
            )}
            {allModelList.map((m, i) => (
              <Bar
                key={m}
                dataKey={m}
                stackId="t"
                fill={m === '__projected__' ? 'rgba(113,113,122,0.25)' : modelColor(m)}
                radius={i === allModelList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {modelList.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 pl-[44px]">
          {modelList.map((m) => (
            <span key={m} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: modelColor(m) }}
              />
              <span className="text-[11px] text-zinc-400">{shortModel(m)}</span>
            </span>
          ))}
          {hasProjection && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full flex-shrink-0 bg-zinc-600/50" />
              <span className="text-[11px] text-zinc-500">projected</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

