import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { usd, shortModel, dayLabel } from '@/lib/format';
import { modelColor } from '@/lib/palette';
import type { LiteLlmDailyChartProps, LiteLlmDailyTooltipProps } from './types';

const BAR = '#10b981';
const BAR_TODAY = '#34d399';

/** Hover card: day total, per-model breakdown (sorted desc), and request count. */
function DailyTooltip({ active, payload }: LiteLlmDailyTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const models = Object.entries(d.byModel)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  return (
    <ChartTooltip minWidth={180}>
      <div className="mb-2 font-semibold text-zinc-300">
        {d.full}
        {d.isToday && <span className="ml-1 font-normal text-emerald-400">· today</span>}
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-zinc-500">Day spend</span>
        <span className="font-bold text-emerald-400">{usd(d.cost)}</span>
      </div>
      {models.length > 0 && (
        <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
          {models.map(([m, v]) => (
            <div key={m} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: modelColor(m) }} />
                <span className="text-zinc-300">{shortModel(m)}</span>
              </span>
              <span className="font-semibold text-zinc-100">{usd(v)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 border-t border-white/10 pt-2 text-xs text-zinc-500">
        {d.requests.toLocaleString()} requests
      </div>
    </ChartTooltip>
  );
}

/** Vertical bar chart of actual daily spend (last 7 days, left→right). Today's
 *  bar is brighter; hovering a bar reveals the per-model breakdown. */
export function LiteLlmDailyChart({ days }: LiteLlmDailyChartProps) {
  const data = days.map((d, i) => {
    const [y, mo, da] = d.date.split('-').map(Number);
    const full = dayLabel(new Date(y, mo - 1, da).getTime());
    return {
      label: full.split(', ')[1] ?? full, // "Jun 22"
      full, // "Mon, Jun 22"
      cost: d.cost,
      requests: d.requests,
      byModel: d.byModel,
      isToday: i === days.length - 1,
    };
  });
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#26262f" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v) => usd(Number(v))}
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<DailyTooltip />} />
          <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.isToday ? BAR_TODAY : BAR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
