import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { compact, usd } from '@/lib/format';
import { tagColor, UNTAGGED_COLOR } from '@/lib/palette';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import type { TagBreakdownProps } from './types';
import { groupByTag, UNTAGGED } from './utils';

const labelOf = (tag: string) => (tag === UNTAGGED ? 'Untagged' : tag);
const colorOf = (tag: string) => (tag === UNTAGGED ? UNTAGGED_COLOR : tagColor(tag));

export function TagBreakdown({ sessions, projectCosts, tags }: TagBreakdownProps) {
  const groups = useMemo(
    () => groupByTag(sessions, projectCosts, tags),
    // tags.tags is the underlying map — recompute when a tag is added/removed
    [sessions, projectCosts, tags.tags], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const hasTags = tags.allTags().length > 0;

  const data = groups.filter((g) => g.cost > 0).map((g) => ({ name: g.tag, value: g.cost }));
  const total = data.reduce((s, d) => s + d.value, 0);

  const header = (
    <div>
      <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-300">
        Spend by Tag
        <InfoTip text="Estimated cost grouped by the custom tags you assign to projects on the left. A project with multiple tags counts toward each. Tags live only in your browser — nothing is sent anywhere." />
      </h3>
      <p className="text-xs text-zinc-500 mt-0.5">Cost attribution across your tags</p>
    </div>
  );

  if (!hasTags) {
    return (
      <div className="card p-5 flex min-h-[200px] flex-col">
        {header}
        <div className="flex flex-1 items-center justify-center py-10 text-center text-xs italic text-zinc-500">
          Add a tag to any project above to group its cost here.
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      {header}
      <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row">
        {data.length > 0 && (
          <div className="h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart style={{ background: 'transparent' }}>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={80}
                  stroke="#131318"
                  strokeWidth={2}
                >
                  {data.map((d) => (
                    <Cell key={d.name || 'untagged'} fill={colorOf(d.name)} />
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
                  formatter={(value: number, name: string) => [usd(value), labelOf(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <ul className="w-full flex-1 space-y-2">
          {groups.map((g) => (
            <li key={g.tag || 'untagged'} className="flex items-center justify-between text-sm">
              <LegendDot
                color={colorOf(g.tag)}
                label={labelOf(g.tag)}
                size="md"
                labelClassName="text-zinc-300"
              />
              <span className="tabular-nums text-zinc-400">
                {g.cost > 0 ? usd(g.cost) : <span className="text-zinc-600">no cost</span>}
                {total > 0 && g.cost > 0 && ` · ${((g.cost / total) * 100).toFixed(0)}%`}
                <span className="ml-2 text-zinc-600">{compact(g.effectiveTokens)} tok</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
