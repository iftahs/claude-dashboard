import { useEffect, useState } from 'react';
import { compact } from '@/lib/format';
import { useBlockAlerts } from '@/hooks/useBlockAlerts';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import type { BlockGaugeProps } from './types';
import { BLOCK_MS, DEFAULT_BLOCK_LIMIT, formatRemaining } from './utils';

export function BlockGauge({ block, liveUsage }: BlockGaugeProps) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const effective = block?.totals.effectiveTokens ?? 0;
  const prevEffective = block?.prevTotals.effectiveTokens ?? 0;

  const blockLimit = DEFAULT_BLOCK_LIMIT;

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

  // Resets in — when live API has no active block (resets_at=null), show helpful hint
  const liveResetsAt = hasLive ? Date.parse(liveUsage.five_hour.resets_at) : null;
  const noActiveBlock = hasLive && liveUsage.five_hour.resets_at == null;
  const blockResetsAt = liveResetsAt && !isNaN(liveResetsAt) ? liveResetsAt : (block?.resetsAt ?? (now + BLOCK_MS));
  const remainingMs = Math.max(0, blockResetsAt - now);
  const resetStr = noActiveBlock ? 'on next message' : formatRemaining(remainingMs);

  // ── Burn rate calculation ────────────────────────────────────────────────
  // Tokens consumed so far ÷ elapsed block time = tokens/hour pace
  const blockStart = block?.start ?? now;
  const elapsedMs = Math.max(60_000, now - blockStart); // floor at 1 min to avoid div-by-zero
  const burnRatePerHour = effective > 0 ? Math.round((effective / elapsedMs) * 3600_000) : 0;
  const remainingCapacity = Math.max(0, blockLimit - effective);
  const minsUntilLimit =
    burnRatePerHour > 0 ? Math.round((remainingCapacity / burnRatePerHour) * 60) : null;

  const burnRateStr = burnRatePerHour > 0 ? `${compact(burnRatePerHour)} / hr` : null;
  const limitEtaStr =
    minsUntilLimit !== null && tokPct < 100
      ? minsUntilLimit < 60
        ? `limit in ~${minsUntilLimit}m`
        : `limit in ~${Math.round(minsUntilLimit / 60)}h ${minsUntilLimit % 60}m`
      : null;

  const burnColor =
    minsUntilLimit !== null && minsUntilLimit < 30
      ? '#ef4444'
      : minsUntilLimit !== null && minsUntilLimit < 60
      ? '#f59e0b'
      : '#71717a';

  // ── Budget alerts ────────────────────────────────────────────────────────
  const { permission } = useBlockAlerts(Math.round(tokPct));

  // Status indicator
  let statusBadge = null;
  if (hasLive) {
    statusBadge = (
      <div className="mt-0.5 text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1 select-none">
        <span className="animate-pulse">●</span> Live from Claude.ai
      </div>
    );
  } else if (liveUsage?.error) {
    const isExpired = liveUsage.error.toLowerCase().includes('expired');
    statusBadge = (
      <div
        className={`mt-0.5 text-[10px] cursor-help ${
          isExpired ? 'text-amber-400' : 'text-amber-500/70'
        }`}
        title={liveUsage.error}
      >
        {isExpired
          ? '⚠️ Token expired — run any Claude Code cmd to refresh'
          : '⚠️ Local logs only (hover for details)'}
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
        <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-zinc-500 font-bold">
          Claude Code · block usage
          <InfoTip
            align="center"
            text="Your current 5-hour usage block, anchored to your most recent session's first message (how Anthropic starts a 5h window). The ring shows % of the live account limit from Claude.ai; rows below show this block's effective tokens, cache reads, reset time and burn rate."
          />
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

        {/* Burn rate row */}
        {burnRateStr && (
          <div className="flex justify-between pt-1 mt-1 border-t border-white/5" style={{ color: burnColor }}>
            <span className="text-zinc-500">Burn rate</span>
            <span className="tabular-nums font-semibold text-xs">
              {burnRateStr}
              {limitEtaStr && (
                <span className="ml-1.5 font-normal opacity-80">· {limitEtaStr}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Notification permission badge */}
      {permission !== 'granted' && (
        <div className="mt-3 w-full text-center text-[10px] text-zinc-600">
          {permission === 'denied' ? '🔕 Alerts blocked by browser' : '🔔 Allow notifications for limit alerts'}
        </div>
      )}
    </div>
  );
}
