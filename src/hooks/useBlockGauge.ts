import { useEffect, useState } from 'react';
import { compact, usd } from '../lib/format';
import { useBlockAlerts } from './useBlockAlerts';
import {
  BLOCK_MS,
  DEFAULT_BLOCK_LIMIT,
  formatRemaining,
} from '@/components/design-system/organisms/BlockGauge/utils';
import type { BlockGaugeProps } from '@/components/design-system/organisms/BlockGauge/types';

export interface BlockGaugeView {
  effective: number;
  prevEffective: number;
  cost: number;
  prevCost: number;
  capPct: number | null;
  tokPct: number;
  /** SVG ring geometry. */
  r: number;
  c: number;
  dash: number;
  ringColor: string;
  resetStr: string;
  burnRateStr: string | null;
  limitEtaStr: string | null;
  burnColor: string;
  hasLive: boolean;
  permission: NotificationPermission;
}

/**
 * All of BlockGauge's derived view-model: ring geometry/color, reset countdown,
 * burn rate + ETA, and the live-vs-estimate selection. Ticks every second so the
 * countdown stays live, and wires the subscription budget alerts.
 */
export function useBlockGauge({
  block,
  liveUsage,
  isApi = false,
  costPerDay = 0,
  dailyLimit = null,
  todayActualCost = null,
}: BlockGaugeProps): BlockGaugeView {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const effective = block?.totals.effectiveTokens ?? 0;
  const prevEffective = block?.prevTotals.effectiveTokens ?? 0;

  const blockLimit = DEFAULT_BLOCK_LIMIT;

  const hasLive = !isApi && !!liveUsage && !liveUsage.error;

  // ── API / pay-as-you-go: cost-based ring ──────────────────────────────────
  const cost = block?.totals.cost ?? 0;
  const prevCost = block?.prevTotals.cost ?? 0;
  // Daily-cap ring: prefer real billed spend so far today (gateway) over the
  // estimated average $/day, so the cap warning reflects actual money spent.
  const dailySpend = todayActualCost ?? costPerDay;
  const capPct = isApi && dailyLimit ? Math.min(100, (dailySpend / dailyLimit) * 100) : null;

  const tokPct = hasLive
    ? liveUsage!.five_hour.utilization
    : Math.min(100, (effective / blockLimit) * 100);

  // Ring fraction & color depend on mode.
  const ringFrac = isApi ? (capPct ?? 0) / 100 : tokPct / 100;
  const ringPct = isApi ? capPct ?? 0 : tokPct;

  const r = 78;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(1, ringFrac));
  const ringColor = ringPct > 90 ? '#ef4444' : ringPct > 70 ? '#f59e0b' : '#d97757';

  // Resets in — when live API has no active block (resets_at=null), show helpful hint
  const liveResetsAt = hasLive ? Date.parse(liveUsage!.five_hour.resets_at) : null;
  const noActiveBlock = hasLive && liveUsage!.five_hour.resets_at == null;
  const blockResetsAt = liveResetsAt && !isNaN(liveResetsAt) ? liveResetsAt : (block?.resetsAt ?? (now + BLOCK_MS));
  const remainingMs = Math.max(0, blockResetsAt - now);
  const resetStr = noActiveBlock ? 'on next message' : formatRemaining(remainingMs);

  // ── Burn rate calculation ────────────────────────────────────────────────
  const blockStart = block?.start ?? now;
  const elapsedMs = Math.max(60_000, now - blockStart); // floor at 1 min to avoid div-by-zero
  const burnRatePerHour = effective > 0 ? Math.round((effective / elapsedMs) * 3600_000) : 0;
  const burnCostPerHour = cost > 0 ? (cost / elapsedMs) * 3600_000 : 0;
  const remainingCapacity = Math.max(0, blockLimit - effective);
  const minsUntilLimit =
    burnRatePerHour > 0 ? Math.round((remainingCapacity / burnRatePerHour) * 60) : null;

  const burnRateStr = isApi
    ? burnCostPerHour > 0
      ? `${usd(burnCostPerHour)} / hr`
      : null
    : burnRatePerHour > 0
    ? `${compact(burnRatePerHour)} / hr`
    : null;
  const limitEtaStr =
    !isApi && minsUntilLimit !== null && tokPct < 100
      ? minsUntilLimit < 60
        ? `limit in ~${minsUntilLimit}m`
        : `limit in ~${Math.round(minsUntilLimit / 60)}h ${minsUntilLimit % 60}m`
      : null;

  const burnColor = isApi
    ? '#71717a'
    : minsUntilLimit !== null && minsUntilLimit < 30
    ? '#ef4444'
    : minsUntilLimit !== null && minsUntilLimit < 60
    ? '#f59e0b'
    : '#71717a';

  // ── Budget alerts (subscription token % only) ─────────────────────────────
  const { permission } = useBlockAlerts(Math.round(isApi ? 0 : tokPct));

  return {
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
  };
}
