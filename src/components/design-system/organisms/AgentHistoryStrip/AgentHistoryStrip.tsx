import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { compact } from '@/lib/format';
import type { AgentHistoryStripProps, MiniStatProps } from './types';
import { TYPE_BAR_COLOR, topTypes } from './utils';

function MiniStat({ label, value, sub }: MiniStatProps) {
  return (
    <div className="min-w-0 rounded-xl bg-ink-800/50 p-3 ring-1 ring-white/10">
      <div className="truncate text-xs text-zinc-500" title={label}>
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-zinc-200">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

/**
 * Compact "last N days" summary for the Agents tab — spawns, per-session delegation
 * and the busiest subagent types — so the tab says something useful when no agent is
 * running. One component for both platforms; the Agents tab renders one per platform.
 */
export function AgentHistoryStrip({ data, loading, error, title, help, days, stacked = false }: AgentHistoryStripProps) {
  const { rows, rest } = topTypes(data?.byType ?? {}, 4);
  const layout = stacked ? 'grid gap-4' : 'grid gap-4 sm:grid-cols-2';

  return (
    <Section title={title} help={help}>
      {!data && (loading || !error) ? (
        <div className={layout}>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] rounded-xl" />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded" />
            ))}
          </div>
        </div>
      ) : !data ? (
        <div className="py-1 text-xs text-zinc-600">History unavailable right now.</div>
      ) : data.spawns === 0 ? (
        <div className="flex items-center gap-2 py-1 text-xs text-zinc-600">
          <span className="inline-block h-1.5 w-1.5 flex-none rounded-full bg-zinc-700" />
          No subagents spawned in the last {days} days
        </div>
      ) : (
        <div className={layout}>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Spawns" value={compact(data.spawns)} sub={`last ${days} days`} />
            <MiniStat label="Avg per session" value={data.avgPerSession.toFixed(1)} sub="sessions that delegated" />
            <MiniStat
              label="Delegation rate"
              value={`${Math.round(data.delegationRate * 100)}%`}
              sub="of sessions"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">By type</div>
            {rows.map((r) => (
              <div key={r.type} className="flex items-center gap-3">
                <span className="w-28 flex-none truncate text-xs text-zinc-400" title={r.label}>
                  {r.label}
                </span>
                <ProgressBar pct={r.pct} color={TYPE_BAR_COLOR} className="flex-1" />
                <span className="w-10 flex-none text-right text-xs tabular-nums text-zinc-300">{compact(r.count)}</span>
              </div>
            ))}
            {rest > 0 && <div className="text-[11px] text-zinc-600">+{rest} more type{rest === 1 ? '' : 's'}</div>}
          </div>
        </div>
      )}
    </Section>
  );
}
