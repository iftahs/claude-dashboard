import { useEffect, useState } from 'react';
import type { ActiveBlock } from '../types';
import type { Limits } from '../hooks/useLimits';
import { compact } from '../lib/format';

const BLOCK_MS = 5 * 3600_000;

function pct(used: number, limit: number | null): number | null {
  if (!limit || limit <= 0) return null;
  return Math.min(100, (used / limit) * 100);
}

export function BlockGauge({
  block,
  limits,
}: {
  block: ActiveBlock | null;
  limits: Limits;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const effective = block?.totals.effectiveTokens ?? 0;
  const prevEffective = block?.prevTotals.effectiveTokens ?? 0;
  const tokPct = pct(effective, limits.blockLimit);

  // Ring: show token % if limit set, else time elapsed
  const elapsed = block ? Math.min(BLOCK_MS, now - block.start) : 0;
  const timeFrac = elapsed / BLOCK_MS;
  const ringFrac = tokPct !== null ? tokPct / 100 : timeFrac;

  const r = 78;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(1, ringFrac));
  const ringColor = tokPct !== null && tokPct > 90 ? '#ef4444' : tokPct !== null && tokPct > 70 ? '#f59e0b' : '#d97757';

  return (
    <div className="card flex flex-col items-center justify-center p-6">
      <div className="text-center">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          {tokPct !== null ? 'Claude Code · block usage' : 'Claude Code · 5h session'}
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-600">Claude.ai tracked separately</div>
      </div>

      <div className="relative mt-4 h-[200px] w-[200px]">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <circle cx="100" cy="100" r={r} fill="none" stroke="#26262f" strokeWidth="14" />
          <circle
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {tokPct !== null ? (
            <>
              <div className="text-3xl font-bold tabular-nums" style={{ color: ringColor }}>
                {tokPct.toFixed(0)}%
              </div>
              <div className="text-xs text-zinc-500">used</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold tabular-nums text-clay-400">
                {compact(block?.totals.totalTokens ?? 0)}
              </div>
              <div className="text-xs text-zinc-500">tokens</div>
            </>
          )}
        </div>
      </div>

      {/* Token detail rows */}
      <div className="mt-4 w-full space-y-1 text-sm">
        <div className="flex justify-between text-zinc-300">
          <span>Effective tokens</span>
          <span className="font-semibold tabular-nums text-clay-400">{compact(effective)}</span>
        </div>
        {prevEffective > 0 && (
          <div className="flex justify-between text-zinc-500">
            <span>Prev block</span>
            <span className="tabular-nums">{compact(prevEffective)}</span>
          </div>
        )}
        <div className="flex justify-between text-zinc-500">
          <span>Cache reads</span>
          <span className="tabular-nums">{compact(block?.totals.cacheReadTokens ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}
