import { useEffect, useState } from 'react';
import type { ActiveBlock, LiveUsageData } from '../types';
import type { Limits } from '../hooks/useLimits';
import { compact } from '../lib/format';

const BLOCK_MS = 5 * 3600_000;
const DEFAULT_BLOCK_LIMIT = 6000000; // 6.0M effective tokens

function formatRemaining(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  if (mins <= 0) return '0m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (remMins === 0) return `${hrs}h`;
  return `${hrs}h ${remMins}m`;
}

export function BlockGauge({
  block,
  limits,
  liveUsage,
}: {
  block: ActiveBlock | null;
  limits: Limits;
  liveUsage?: LiveUsageData | null;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const effective = block?.totals.effectiveTokens ?? 0;
  const prevEffective = block?.prevTotals.effectiveTokens ?? 0;
  
  const blockLimit = limits.blockLimit ?? DEFAULT_BLOCK_LIMIT;
  
  const hasLive = liveUsage && !liveUsage.error;
  const tokPct = hasLive 
    ? liveUsage.five_hour.utilization 
    : Math.min(100, (effective / blockLimit) * 100);

  // Ring: show token %
  const ringFrac = tokPct / 100;

  const r = 78;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(1, ringFrac));
  const ringColor = tokPct > 90 ? '#ef4444' : tokPct > 70 ? '#f59e0b' : '#d97757';

  // Resets in
  const liveResetsAt = hasLive ? Date.parse(liveUsage.five_hour.resets_at) : null;
  const blockResetsAt = liveResetsAt && !isNaN(liveResetsAt) ? liveResetsAt : (block?.resetsAt ?? (now + BLOCK_MS));
  const remainingMs = Math.max(0, blockResetsAt - now);
  const resetStr = formatRemaining(remainingMs);

  // Status indicator
  let statusBadge = null;
  if (hasLive) {
    statusBadge = (
      <div className="mt-0.5 text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1 select-none">
        <span className="animate-pulse">●</span> Live from Claude.ai
      </div>
    );
  } else if (liveUsage?.error) {
    statusBadge = (
      <div className="mt-0.5 text-[10px] text-amber-500/70 cursor-help" title={liveUsage.error}>
        Local logs (Claude.ai connection paused)
      </div>
    );
  } else {
    statusBadge = (
      <div className="mt-0.5 text-[10px] text-zinc-600">
        Local logs (connecting to Claude.ai...)
      </div>
    );
  }

  return (
    <div className="card flex flex-col items-center justify-center p-6">
      <div className="text-center">
        <div className="text-xs uppercase tracking-wider text-zinc-500 font-bold">
          Claude Code · block usage
        </div>
        {statusBadge}
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
          <div className="text-3xl font-bold tabular-nums" style={{ color: ringColor }}>
            {tokPct.toFixed(0)}%
          </div>
          <div className="text-xs text-zinc-500">used</div>
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
        <div className="flex justify-between text-zinc-500">
          <span>Resets in</span>
          <span className="tabular-nums text-zinc-400 font-semibold">{resetStr}</span>
        </div>
      </div>
    </div>
  );
}
