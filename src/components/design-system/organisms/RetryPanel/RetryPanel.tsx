import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact, usd } from '@/lib/format';
import type { RetryPanelProps } from './types';

export function RetryPanel({ data }: RetryPanelProps) {
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
      </div>
    );
  }

  const { oneShotRate, totalEdits, retried, wastedTokens, wastedCost } = data;

  return (
    <div className="space-y-5">
      {/* Big one-shot rate number */}
      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-500">One-shot rate</div>
        <div className="mt-1 text-4xl font-bold tabular-nums text-clay-400">
          {(oneShotRate * 100).toFixed(1)}%
        </div>
        <div className="mt-1 text-sm text-zinc-500">
          of {compact(totalEdits)} Edit/Write calls succeeded first try
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-ink-800/50 p-3 ring-1 ring-white/5">
          <div className="text-xs text-zinc-500">Retried edits</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-amber-400">{retried}</div>
        </div>
        <div className="rounded-xl bg-ink-800/50 p-3 ring-1 ring-white/5">
          <div className="text-xs text-zinc-500">Wasted tokens</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-zinc-400">
            {compact(wastedTokens)}
          </div>
        </div>
      </div>

      {wastedCost > 0 && (
        <div className="text-sm text-zinc-400">
          Estimated wasted cost:{' '}
          <span className="font-semibold text-amber-400">{usd(wastedCost)}</span>
        </div>
      )}

      <div className="text-[10px] text-zinc-600">
        Wasted tokens are approximated from avg tokens/turn &times; errored edit calls.
      </div>
    </div>
  );
}
