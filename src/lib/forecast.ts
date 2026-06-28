/** Linear projection of weekly limit usage at reset, given the current pace. */
export interface WeeklyForecast {
  /** Extrapolated utilization (%) at the reset moment. */
  projectedPct: number;
  /** True when projected to cross 100% before the weekly window resets. */
  willExceed: boolean;
  /** Compact display string, e.g. "on track · ~72% by reset" or "limit in ~2d". */
  label: string;
  /** Severity color for the label. */
  color: string;
}

function formatEta(ms: number): string {
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}

/**
 * Project where weekly usage lands by the reset if the current burn rate holds.
 * A naive linear extrapolation: usage so far ÷ fraction-of-window-elapsed. Returns
 * null when it's too early to say (the window just started) or the inputs are
 * degenerate. This is the cross-window analog to BlockGauge's single-block ETA.
 */
export function buildWeeklyForecast(input: {
  /** Current weekly utilization, 0–100. */
  pct: number;
  /** Epoch ms the weekly window began. */
  windowStart: number;
  /** Epoch ms the weekly window resets. */
  resetsAt: number;
  now: number;
}): WeeklyForecast | null {
  const { pct, windowStart, resetsAt, now } = input;
  if (resetsAt <= now || windowStart >= now) return null;

  const elapsed = now - windowStart;
  const total = resetsAt - windowStart;
  if (elapsed < 30 * 60_000 || total <= 0) return null; // too early to extrapolate

  const elapsedFrac = elapsed / total;
  const projectedPct = elapsedFrac > 0 ? pct / elapsedFrac : pct;

  if (pct >= 100) {
    return { projectedPct: 100, willExceed: true, label: 'weekly limit reached', color: '#ef4444' };
  }

  if (projectedPct >= 100 && pct > 0) {
    // Remaining time until usage hits 100% at the current pace.
    const msTo100 = (100 / pct) * elapsed - elapsed;
    const color = msTo100 < 86_400_000 ? '#ef4444' : '#f59e0b';
    return { projectedPct, willExceed: true, label: `on pace to hit limit in ~${formatEta(msTo100)}`, color };
  }

  return {
    projectedPct,
    willExceed: false,
    label: `on track · ~${Math.round(projectedPct)}% by reset`,
    color: '#71717a',
  };
}
