import { compact, usd } from '@/lib/format';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { useBlockGauge } from '@/hooks/useBlockGauge';
import type { BlockGaugeProps } from './types';

export function BlockGauge(props: BlockGaugeProps) {
  const { block, liveUsage, isApi = false, todayActualCost = null } = props;
  const {
    effective,
    prevEffective,
    cost,
    prevCost,
    capPct,
    tokPct,
    r,
    c,
    dash,
    ringColor,
    resetStr,
    burnRateStr,
    limitEtaStr,
    burnColor,
    hasLive,
    permission,
  } = useBlockGauge(props);

  // Status indicator
  let statusBadge = null;
  if (isApi) {
    statusBadge = (
      <div className="mt-0.5 text-[10px] text-zinc-500 select-none">
        {todayActualCost != null
          ? '5-hour block (est.) · cap ring = real gateway spend'
          : 'Current 5-hour session · estimated from local logs'}
      </div>
    );
  } else if (hasLive) {
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
          {isApi ? 'Claude Code · spend this block' : 'Claude Code · block usage'}
          <InfoTip
            align="center"
            text={
              isApi
                ? todayActualCost != null
                  ? "The big number is the estimated cost of your current 5-hour block (published API rates, from local logs). The daily-cap ring uses your real billed spend so far today from your LiteLLM gateway — see API Spending below for the real today / week / month figures. Set a daily cap in ⚙ Settings."
                  : "Estimated cost of your current 5-hour usage block, anchored to your most recent session's first message. Dollar figures use Anthropic's published API rates and are computed from local logs. The ring fills against your daily spending cap when one is set in ⚙ Settings."
                : "Your current 5-hour usage block, anchored to your most recent session's first message (how Anthropic starts a 5h window). The ring shows % of the live account limit from Claude.ai; rows below show this block's effective tokens, cache reads, reset time and burn rate."
            }
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
            strokeLinecap={dash > 0 ? 'round' : 'butt'}
            strokeDasharray={`${dash} ${c}`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isApi ? (
            <>
              <div className="text-3xl font-bold tabular-nums text-clay-400">{usd(cost)}</div>
              <div className="text-xs text-zinc-500">{compact(effective)} tokens</div>
              {capPct != null && (
                <div className="mt-0.5 text-[10px] text-zinc-600">{capPct.toFixed(0)}% of daily cap</div>
              )}
            </>
          ) : (
            <>
              <div className="text-3xl font-bold tabular-nums" style={{ color: ringColor }}>
                {tokPct.toFixed(0)}%
              </div>
              <div className="text-xs text-zinc-500">used</div>
            </>
          )}
        </div>
      </div>

      {/* Detail rows */}
      <div className="mt-4 w-full space-y-1 text-sm">
        {isApi ? (
          <>
            <div className="flex justify-between text-zinc-300">
              <span>Effective tokens</span>
              <span className="font-semibold tabular-nums text-clay-400">{compact(effective)}</span>
            </div>
            {prevCost > 0 && (
              <div className="flex justify-between text-zinc-500">
                <span>Prev block</span>
                <span className="tabular-nums">{usd(prevCost)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-500">
              <span>Cache reads</span>
              <span className="tabular-nums">{compact(block?.totals.cacheReadTokens ?? 0)}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Block resets in</span>
              <span className="tabular-nums text-zinc-400 font-semibold">{resetStr}</span>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}

        {/* Burn rate row */}
        {burnRateStr && (
          <div className="flex justify-between pt-1 mt-1 border-t border-white/10" style={{ color: burnColor }}>
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

      {/* Notification permission badge (subscription limit alerts only) */}
      {!isApi && permission !== 'granted' && (
        <div className="mt-3 w-full text-center text-[10px] text-zinc-600">
          {permission === 'denied' ? '🔕 Alerts blocked by browser' : '🔔 Allow notifications for limit alerts'}
        </div>
      )}
    </div>
  );
}
