import { useEffect, useState } from 'react';
import { compact, usd } from '../lib/format';
import { limitColor, liveWindowEta, resolveLimitAlerts } from '../lib/limits';
import { useConfigMode } from './useConfigMode';
import {
  BLOCK_MS,
  CLAUDE_GAUGE_LABELS,
  DEFAULT_BLOCK_LIMIT,
  formatMins,
  formatRemaining,
} from '@/components/design-system/organisms/BlockGauge/utils';
import type { BlockGaugeLabels, BlockGaugeProps } from '@/components/design-system/organisms/BlockGauge/types';

export interface BlockGaugeView {
  labels: BlockGaugeLabels;
  effective: number;
  prevEffective: number;
  cacheReads: number;
  cost: number;
  prevCost: number;
  capPct: number | null;
  /** % shown in the ring; null when there is neither a live reading nor a known block limit. */
  tokPct: number | null;
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
  /** Show the "allow notifications" hint (limit alerts are on and not yet permitted). */
  showPermissionHint: boolean;
  permission: NotificationPermission;
}

const NEUTRAL = '#71717a';

/**
 * All of BlockGauge's derived view-model: ring geometry/color, reset countdown,
 * burn rate + ETA, and the live-vs-estimate selection. Ticks every second so the
 * countdown stays live. Limit alerts are app-level (useLimitAlerts), not here, so
 * they fire on every tab and platform.
 *
 * The rows are the local block (the Claude session's current block, or Codex's
 * current window); the ring and the ETA are the provider's live % when there is one.
 * The ETA extrapolates that % at its average pace since the window opened, so it can
 * never contradict the ring — the local block's tokens against the 6M heuristic are
 * only the offline fallback.
 */
export function useBlockGauge({
  block,
  live = null,
  isApi = false,
  costPerDay = 0,
  dailyLimit = null,
  todayActualCost = null,
  blockLimit = DEFAULT_BLOCK_LIMIT,
  windowMs = BLOCK_MS,
  labels: labelOverrides,
}: BlockGaugeProps): BlockGaugeView {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const { settings } = useConfigMode();

  const labels = { ...CLAUDE_GAUGE_LABELS, ...labelOverrides };
  const now = Date.now();
  const hasLive = !isApi && !!live;

  // An expired local block must read as ended, live reading or not (a live window
  // with no reset, or a Codex block that fell back to the local anchor), not as
  // the last session's tokens. The client-clock check covers a server block
  // memoised before it expired. Once it has ended, that block is the previous one.
  const blockEnded = !!block && (!block.isActive || block.resetsAt <= now);
  const current = blockEnded ? null : block?.totals;
  const previous = blockEnded ? block?.totals : block?.prevTotals;
  const effective = current?.effectiveTokens ?? 0;
  const prevEffective = previous?.effectiveTokens ?? 0;
  const cacheReads = current?.cacheReadTokens ?? 0;

  // ── API / pay-as-you-go: cost-based ring ──────────────────────────────────
  const cost = current?.cost ?? 0;
  const prevCost = previous?.cost ?? 0;
  // Daily-cap ring: prefer real billed spend so far today (gateway) over the
  // estimated average $/day, so the cap warning reflects actual money spent.
  const dailySpend = todayActualCost ?? costPerDay;
  const capPct = isApi && dailyLimit ? Math.min(100, (dailySpend / dailyLimit) * 100) : null;

  const tokPct = hasLive
    ? live!.pct
    : blockLimit
    ? Math.min(100, (effective / blockLimit) * 100)
    : null;

  // Ring fraction & color depend on mode.
  const ringPct = isApi ? capPct ?? 0 : tokPct ?? 0;
  const r = 78;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(1, ringPct / 100));
  const ringColor = !isApi && tokPct === null ? NEUTRAL : limitColor(ringPct);

  // Resets in — when there is no active block (live resets_at=null, or the local
  // block has ended), show helpful hint
  const liveResetsAt = hasLive && live!.resetsAt ? Date.parse(live!.resetsAt) : NaN;
  const noActiveBlock = hasLive ? live!.resetsAt == null : blockEnded;
  const blockResetsAt = !isNaN(liveResetsAt) ? liveResetsAt : (block?.resetsAt ?? (now + windowMs));
  const remainingMs = Math.max(0, blockResetsAt - now);
  const resetStr = noActiveBlock ? 'on next message' : formatRemaining(remainingMs);

  // ── Burn rate: this block's local pace ────────────────────────────────────
  const blockStart = block?.start ?? now;
  const elapsedMs = Math.max(60_000, now - blockStart); // floor at 1 min to avoid div-by-zero
  const burnRatePerHour = effective > 0 ? Math.round((effective / elapsedMs) * 3600_000) : 0;
  const burnCostPerHour = cost > 0 ? (cost / elapsedMs) * 3600_000 : 0;

  // ── Limit ETA: the live % at its pace since the window opened; offline, the
  //    local block against the heuristic limit (none when the limit is unknown) ──
  let minsUntilLimit: number | null = null;
  let projectedPct: number | null = null;
  if (hasLive && !isNaN(liveResetsAt)) {
    ({ minsUntilLimit, projectedPct } = liveWindowEta(live!.pct, liveResetsAt, windowMs, now));
  } else if (!hasLive && blockLimit && burnRatePerHour > 0) {
    minsUntilLimit = Math.round((Math.max(0, blockLimit - effective) / burnRatePerHour) * 60);
  }

  const burnRateStr = isApi
    ? burnCostPerHour > 0
      ? `${usd(burnCostPerHour)} / hr`
      : null
    : burnRatePerHour > 0
    ? `${compact(burnRatePerHour)} / hr`
    : null;
  const limitEtaStr =
    isApi || (tokPct ?? 0) >= 100
      ? null
      : minsUntilLimit !== null
      ? `limit in ${formatMins(minsUntilLimit)}`
      : projectedPct !== null && hasLive
      ? `~${Math.round(projectedPct)}% at reset`
      : null;

  const burnColor = isApi
    ? NEUTRAL
    : minsUntilLimit !== null && minsUntilLimit < 30
    ? '#ef4444'
    : minsUntilLimit !== null && minsUntilLimit < 60
    ? '#f59e0b'
    : NEUTRAL;

  const permission: NotificationPermission =
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied';
  const alertsOn = resolveLimitAlerts((settings as { limitAlerts?: unknown }).limitAlerts).mode !== 'off';

  return {
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
    showPermissionHint: !isApi && alertsOn && permission !== 'granted',
    permission,
  };
}
