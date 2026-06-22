import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact } from '@/lib/format';
import type { YieldPanelProps } from './types';

export function YieldPanel({ data }: YieldPanelProps) {
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16 w-full rounded" />
          <Skeleton className="h-16 w-full rounded" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  const { committed, tokensCommitted, uncommitted, tokensUncommitted, rate, topUncommitted } = data;

  return (
    <div className="space-y-5">
      {/* Two big numbers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-emerald-500/5 p-3 ring-1 ring-emerald-500/10">
          <div className="text-xs text-zinc-500">Committed sessions</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">{committed}</div>
          <div className="text-xs text-zinc-500">{compact(tokensCommitted)} tokens</div>
        </div>
        <div className="rounded-xl bg-zinc-800/40 p-3 ring-1 ring-white/10">
          <div className="text-xs text-zinc-500">Uncommitted sessions</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-400">{uncommitted}</div>
          <div className="text-xs text-zinc-500">{compact(tokensUncommitted)} tokens</div>
        </div>
      </div>

      {/* Ratio bar */}
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-zinc-500">
          <span>Commit rate</span>
          <span className="font-semibold text-zinc-300">{(rate * 100).toFixed(0)}%</span>
        </div>
        <ProgressBar pct={rate * 100} variant="emerald" />
      </div>

      {/* Top uncommitted sessions */}
      {topUncommitted.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Top uncommitted sessions
          </div>
          <div className="space-y-1.5">
            {topUncommitted.slice(0, 5).map((s, i) => (
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
        Sessions that ran a git commit — a proxy for productive sessions.
      </div>
    </div>
  );
}
