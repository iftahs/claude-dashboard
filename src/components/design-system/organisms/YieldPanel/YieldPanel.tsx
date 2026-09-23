import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact } from '@/lib/format';
import { funnelStages } from './utils';
import type { YieldPanelProps } from './types';

/**
 * Where sessions land: a funnel from every session down to the ones that opened a
 * pull request. Sessions outside a git repo (a chat in a scratch folder) could never
 * commit, so they sit apart instead of counting as misses.
 */
export function YieldPanel({ data }: YieldPanelProps) {
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full rounded" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (data.sessions === 0) {
    return <div className="text-sm text-zinc-500">No sessions in this window.</div>;
  }

  const stages = funnelStages(data);
  const top = Math.max(1, stages[0].count);

  return (
    <div className="space-y-5">
      {/* Funnel */}
      <div className="space-y-2">
        {stages.map((s) => (
          <div key={s.key} className="flex items-center gap-3" title={s.hint}>
            <span className="w-24 shrink-0 text-xs text-zinc-400">{s.label}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink-600">
              <div
                className={`h-full rounded-full transition-all duration-700 ${s.barClass}`}
                style={{ width: `${(s.count / top) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-200">
              {s.count}
            </span>
          </div>
        ))}
      </div>

      {/* Tokens: landed vs not, and the sessions that never could land */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-emerald-500/5 p-2 ring-1 ring-emerald-500/10">
          <div className="text-zinc-500">Committed</div>
          <div className="font-semibold tabular-nums text-emerald-400">{compact(data.tokensCommitted)}</div>
        </div>
        <div className="rounded-lg bg-zinc-800/40 p-2 ring-1 ring-white/10">
          <div className="text-zinc-500">Uncommitted</div>
          <div className="font-semibold tabular-nums text-zinc-300">{compact(data.tokensUncommitted)}</div>
        </div>
        <div className="rounded-lg bg-zinc-800/20 p-2 ring-1 ring-white/5" title="Sessions outside a git repo — excluded from the commit rate.">
          <div className="text-zinc-600">No repo · {data.noRepo}</div>
          <div className="font-semibold tabular-nums text-zinc-500">{compact(data.tokensNoRepo)}</div>
        </div>
      </div>

      {/* Top uncommitted repo sessions */}
      {data.topUncommitted.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Top uncommitted sessions
          </div>
          <div className="space-y-1.5">
            {data.topUncommitted.slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex-1 truncate text-zinc-400" title={s.project}>
                  {s.project}
                </span>
                <span className="shrink-0 text-zinc-600">{s.date}</span>
                <span className="shrink-0 tabular-nums text-zinc-300">{compact(s.effectiveTokens)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-zinc-600">
        Token figures are effective tokens. A session counts as in a repo when a git branch or remote
        was recorded, or it ran git itself.
      </div>
    </div>
  );
}
