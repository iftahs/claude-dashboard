import { compact, usd } from '@/lib/format';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { useBlockGauge } from '@/hooks/useBlockGauge';
import { GATEWAY_API_HELP } from './utils';
import type { BlockGaugeProps } from './types';

// Every platform-specific string comes from `labels` (Claude by default).
export function BlockGauge(props: BlockGaugeProps) {
  const { liveError = null, isApi = false, todayActualCost = null } = props;
  const {
    labels,
    effective,
    prevEffective,
    cacheReads,
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
    showPermissionHint,
    permission,
  } = useBlockGauge(props);

  // Status indicator
  let statusBadge = null;
  if (isApi) {
    statusBadge = (
      <div className="mt-0.5 text-[10px] text-zinc-500 select-none">
        {todayActualCost != null ? '5-hour block (est.) · cap ring = real gateway spend' : labels.apiBadge}
      </div>
    );
  } else if (hasLive) {
    statusBadge = labels.livePulse ? (
      <div className="mt-0.5 text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1 select-none">
        <span className="animate-pulse">●</span> {labels.liveBadge}
      </div>
    ) : (
      <div className="mt-0.5 text-[10px] text-amber-400/80 select-none">{labels.liveBadge}</div>
    );
  } else if (liveError) {
    const isExpired = liveError.toLowerCase().includes('expired');
    statusBadge = (
      <div
        className={`mt-0.5 text-[10px] cursor-help ${isExpired ? 'text-amber-400' : 'text-amber-500/70'}`}
        title={liveError}
      >
        {isExpired ? labels.expiredBadge : labels.offlineBadge}
      </div>
    );
  } else {
    statusBadge = <div className="mt-0.5 text-[10px] text-zinc-600">{labels.connectingBadge}</div>;
  }

  return (
    <div className="card flex flex-col items-center justify-center p-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-zinc-500 font-bold">
          {isApi ? labels.apiTitle : labels.title}
          <InfoTip
            align="center"
            text={isApi ? (todayActualCost != null ? GATEWAY_API_HELP : labels.apiHelp) : labels.help}
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
          ) : tokPct === null ? (
            <>
              <div className="text-3xl font-bold tabular-nums text-zinc-300">{compact(effective)}</div>
              <div className="text-xs text-zinc-500">tokens · limit unknown</div>
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
        <div className="flex justify-between text-zinc-300">
          <span>{labels.current}</span>
          <span className="font-semibold tabular-nums text-clay-400">{compact(effective)}</span>
        </div>
        {isApi
          ? prevCost > 0 && (
              <div className="flex justify-between text-zinc-500">
                <span>{labels.previous}</span>
                <span className="tabular-nums">{usd(prevCost)}</span>
              </div>
            )
          : prevEffective > 0 && (
              <div className="flex justify-between text-zinc-500">
                <span>{labels.previous}</span>
                <span className="tabular-nums">{compact(prevEffective)}</span>
              </div>
            )}
        <div className="flex justify-between text-zinc-500">
          <span>Cache reads</span>
          <span className="tabular-nums">{compact(cacheReads)}</span>
        </div>
        <div className="flex justify-between text-zinc-500">
          <span>{isApi ? 'Block resets in' : 'Resets in'}</span>
          <span className="tabular-nums text-zinc-400 font-semibold">{resetStr}</span>
        </div>

        {/* ETA can stand alone — live % moves with usage from other devices too. */}
        {(burnRateStr || limitEtaStr) && (
          <div className="flex justify-between pt-1 mt-1 border-t border-white/10" style={{ color: burnColor }}>
            <span className="text-zinc-500">Burn rate</span>
            <span className="tabular-nums font-semibold text-xs">
              {burnRateStr ?? '—'}
              {limitEtaStr && <span className="ml-1.5 font-normal opacity-80">· {limitEtaStr}</span>}
            </span>
          </div>
        )}
      </div>

      {/* Notification permission hint (limit alerts are app-wide — see useLimitAlerts) */}
      {showPermissionHint && (
        <div className="mt-3 w-full text-center text-[10px] text-zinc-600">
          {permission === 'denied' ? '🔕 Alerts blocked by browser' : '🔔 Allow notifications for limit alerts'}
        </div>
      )}
    </div>
  );
}
