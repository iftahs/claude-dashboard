/**
 * Shared rate-limit vocabulary: the 70 / 90 % tone thresholds every limit display
 * uses (BlockGauge ring, PlanUsage bars, the sidebar Live badge), the live-window
 * ETA, and the limit-alert settings. One place, so a gauge, a bar and a badge
 * showing the same % never disagree on its colour.
 */

import type { CodexLiveData, LiveUsageData } from '@/types';

/** Utilisation at which a limit display turns amber. */
export const LIMIT_WARN_PCT = 70;
/** Utilisation at which a limit display turns red. */
export const LIMIT_DANGER_PCT = 90;

/** Named like the SidebarBadge tones, so the badge can use it as-is. */
export type LimitTone = 'success' | 'warning' | 'danger';

export function limitTone(pct: number): LimitTone {
  if (pct >= LIMIT_DANGER_PCT) return 'danger';
  if (pct >= LIMIT_WARN_PCT) return 'warning';
  return 'success';
}

/** Fill colour per tone. `success` is the clay accent, not green: a limit bar is usage, not health. */
export const LIMIT_TONE_COLOR: Record<LimitTone, string> = {
  success: '#d97757',
  warning: '#f59e0b',
  danger: '#ef4444',
};

export function limitColor(pct: number): string {
  return LIMIT_TONE_COLOR[limitTone(pct)];
}

const MIN = 60_000;
/** Below this much elapsed window time the pace is noise, not a trend. */
const MIN_ELAPSED_MS = 5 * MIN;

export interface LiveEta {
  /** Minutes until 100% at the average pace so far; null when it would not happen before the reset. */
  minsUntilLimit: number | null;
  /** Utilisation the window lands on at its reset, at that pace. Null when there is no pace yet. */
  projectedPct: number | null;
}

/**
 * Where a live rate-limit window is heading: the provider's own % used, divided by
 * the time since the window opened (reset − length). Uses no local token counts, so
 * it agrees with the ring it sits under whatever the local logs cover.
 */
export function liveWindowEta(pct: number, resetsAt: number, windowMs: number, now: number): LiveEta {
  const none = { minsUntilLimit: null, projectedPct: null };
  const start = resetsAt - windowMs;
  const remaining = resetsAt - now;
  if (!Number.isFinite(pct) || !Number.isFinite(resetsAt) || windowMs <= 0 || remaining <= 0 || now < start) return none;
  if (pct >= 100) return { minsUntilLimit: 0, projectedPct: 100 };
  if (pct <= 0) return { minsUntilLimit: null, projectedPct: 0 };
  const perMs = pct / Math.max(MIN_ELAPSED_MS, now - start);
  const msTo100 = (100 - pct) / perMs;
  return {
    minsUntilLimit: msTo100 <= remaining ? Math.max(1, Math.round(msTo100 / MIN)) : null,
    projectedPct: pct + perMs * remaining,
  };
}

/** "5-hour" for 18000 s, "weekly" for 604800 s, "N-hour" / "N-day" otherwise. */
export function windowName(windowSec: number): string {
  if (windowSec === 5 * 3600) return '5-hour';
  if (windowSec === 7 * 86400) return 'weekly';
  if (windowSec < 86400) return `${Math.round(windowSec / 3600)}-hour`;
  return `${Math.round(windowSec / 86400)}-day`;
}

// ── Limit alerts ────────────────────────────────────────────────────────────

export type LimitAlertMode = 'off' | 'notification' | 'sound';

export interface LimitAlertConfig {
  mode: LimitAlertMode;
  /** Ascending % thresholds (1–99). Reaching 100% always alerts on top of these. */
  thresholds: number[];
}

export const DEFAULT_LIMIT_ALERT_THRESHOLDS: readonly number[] = [LIMIT_WARN_PCT, LIMIT_DANGER_PCT];

const MODES: readonly LimitAlertMode[] = ['off', 'notification', 'sound'];

/**
 * The limit-alert preference from Settings (`settings.limitAlerts`), whatever shape
 * it is stored in: a mode string like `budgetAlert`, a boolean, or
 * `{ mode?, enabled?, thresholds? }`. Absent or malformed → notifications at 70 / 90 %.
 */
export function resolveLimitAlerts(raw: unknown): LimitAlertConfig {
  const fallback: LimitAlertConfig = { mode: 'notification', thresholds: [...DEFAULT_LIMIT_ALERT_THRESHOLDS] };
  if (typeof raw === 'string') return MODES.includes(raw as LimitAlertMode) ? { ...fallback, mode: raw as LimitAlertMode } : fallback;
  if (typeof raw === 'boolean') return raw ? fallback : { ...fallback, mode: 'off' };
  if (!raw || typeof raw !== 'object') return fallback;
  const o = raw as { mode?: unknown; enabled?: unknown; thresholds?: unknown };
  const mode: LimitAlertMode =
    o.enabled === false ? 'off' : MODES.includes(o.mode as LimitAlertMode) ? (o.mode as LimitAlertMode) : fallback.mode;
  const picked = Array.isArray(o.thresholds)
    ? [...new Set(o.thresholds.filter((t): t is number => typeof t === 'number' && t > 0 && t < 100).map(Math.round))]
        .sort((a, b) => a - b)
    : [];
  return { mode, thresholds: picked.length ? picked : fallback.thresholds };
}

const HOUR_MS = 3600_000;

function epoch(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Every window a limit alert can watch right now: Claude.ai's five_hour and
 * seven_day (pass null in API mode or on a live error), and Codex's 5-hour and
 * weekly windows. A window with no reset time is not running, so it is skipped.
 * Codex's `limitReached` marks its fullest open window as reached — the provider's
 * own flag outranks a snapshot that read 98%.
 */
export function limitReadings(
  claude: LiveUsageData | null,
  codex: CodexLiveData | null,
): LimitReading[] {
  const out: LimitReading[] = [];
  if (claude && !claude.error) {
    const add = (key: string, label: string, w: LiveUsageData['five_hour'] | null | undefined, windowMs: number) => {
      const resetsAt = epoch(w?.resets_at);
      if (!w || resetsAt === null) return;
      out.push({ key, platform: 'Claude', label, pct: w.utilization, resetsAt, windowMs, reached: w.utilization >= 100 });
    };
    add('claude-5h', '5-hour limit', claude.five_hour, 5 * HOUR_MS);
    add('claude-weekly', 'weekly limit', claude.seven_day, 7 * 24 * HOUR_MS);
  }
  if (codex && !codex.error) {
    const windows: LimitReading[] = [];
    for (const [key, w] of [['codex-5h', codex.fiveHour], ['codex-weekly', codex.weekly]] as const) {
      const resetsAt = epoch(w?.resetsAt);
      if (!w || resetsAt === null) continue;
      windows.push({
        key, platform: 'Codex', label: `${windowName(w.windowSec)} limit`, pct: w.usedPct, resetsAt,
        windowMs: w.windowSec * 1000, reached: w.usedPct >= 100,
      });
    }
    if (codex.limitReached && windows.length && !windows.some((w) => w.reached)) {
      windows.reduce((a, b) => (b.pct > a.pct ? b : a)).reached = true;
    }
    out.push(...windows);
  }
  return out;
}

/** One provider window an alert can fire on. */
export interface LimitReading {
  /** Stable per platform + window, e.g. 'claude-5h' — the dedupe key and notification tag stem. */
  key: string;
  /** 'Claude' | 'Codex'. */
  platform: string;
  /** '5-hour limit' / 'weekly limit'. */
  label: string;
  pct: number;
  /** Epoch ms; null when the provider reports no active window. */
  resetsAt: number | null;
  windowMs: number;
  /** The provider says this window is exhausted, whatever its % reads. */
  reached: boolean;
}
