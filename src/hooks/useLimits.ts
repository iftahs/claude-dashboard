import { useMemo, useSyncExternalStore } from 'react';
import { useSource, type Platform } from './useSource';

export interface Limits {
  dailyLimit: number | null;   // USD cost cap per day (null = not configured)
  weeklyLimit: number | null;  // USD cost cap per week (null = not configured)
  monthlyLimit: number | null; // USD cost cap per month (null = not configured)
}

/** A platform that has its own spending caps. */
export type CapPlatform = 'claude' | 'codex';

/**
 * Spending caps per platform. Codex is null until the user sets Codex caps — the
 * one-time migration from the single global set gives Claude the old caps and
 * Codex none, so a Claude-only user sees exactly what they had.
 */
export interface PlatformLimits {
  claude: Limits;
  codex: Limits | null;
}

export const NO_LIMITS: Limits = { dailyLimit: null, weeklyLimit: null, monthlyLimit: null };

/** The pre-platform key: one global set of caps. Read once, for the migration, and left in place. */
const LEGACY_KEY = 'claude-dashboard-limits-v2';
const KEY = 'claude-dashboard-limits-v3';

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function asLimits(raw: unknown): Limits | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return { dailyLimit: num(o.dailyLimit), weeklyLimit: num(o.weeklyLimit), monthlyLimit: num(o.monthlyLimit) };
}

function parse(json: string | null): unknown {
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

/**
 * Stored caps → PlatformLimits. A v3 record wins; otherwise the v2 global caps
 * become Claude's and Codex starts with none. Malformed values read as "no cap".
 */
export function migrateLimits(v3: string | null, v2: string | null): PlatformLimits {
  const stored = parse(v3);
  if (stored && typeof stored === 'object' && 'claude' in stored) {
    const s = stored as { claude?: unknown; codex?: unknown };
    return { claude: asLimits(s.claude) ?? NO_LIMITS, codex: asLimits(s.codex) };
  }
  return { claude: asLimits(parse(v2)) ?? NO_LIMITS, codex: null };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// One store for every hook instance (App, Settings, the budget alerts), so a cap
// saved in Settings reaches the Live tab and the alerts without a reload.
let current: PlatformLimits | null = null;
const listeners = new Set<() => void>();

function snapshot(): PlatformLimits {
  if (!current) {
    current = migrateLimits(read(KEY), read(LEGACY_KEY));
    try {
      if (read(KEY) === null) localStorage.setItem(KEY, JSON.stringify(current)); // the one-time migration
    } catch {
      /* private mode — keep it in memory */
    }
  }
  return current;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Replace one platform's caps (null clears Codex's). Persisted, and every subscriber re-renders. */
export function setPlatformLimits(platform: CapPlatform, limits: Limits | null): void {
  const next: PlatformLimits = { ...snapshot() };
  if (platform === 'claude') next.claude = limits ?? NO_LIMITS;
  else next.codex = limits;
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — the in-memory copy still applies this session */
  }
  for (const fn of listeners) fn();
}

export function hasCaps(l: Limits | null | undefined): boolean {
  return !!l && (l.dailyLimit != null || l.weeklyLimit != null || l.monthlyLimit != null);
}

/** Both platforms' caps plus a per-platform setter (Settings, budget alerts). */
export function usePlatformLimits(): [PlatformLimits, (platform: CapPlatform, limits: Limits | null) => void] {
  return [useSyncExternalStore(subscribe, snapshot), setPlatformLimits];
}

function sum(a: number | null, b: number | null): number | null {
  return a != null && b != null ? a + b : null;
}

/**
 * The caps that match what the header platform shows: Claude's, Codex's, or under
 * Both the sum of the two — a combined cap only for a period both platforms cap,
 * since Both compares the combined spend.
 */
export function limitsFor(all: PlatformLimits, platform: Platform): Limits {
  if (platform === 'claude') return all.claude;
  const codex = all.codex ?? NO_LIMITS;
  if (platform === 'codex') return codex;
  return {
    dailyLimit: sum(all.claude.dailyLimit, codex.dailyLimit),
    weeklyLimit: sum(all.claude.weeklyLimit, codex.weeklyLimit),
    monthlyLimit: sum(all.claude.monthlyLimit, codex.monthlyLimit),
  };
}

/** The caps for the platform the header switcher shows (see limitsFor). */
export function useLimits(): Limits {
  const [all] = usePlatformLimits();
  const { platform } = useSource();
  return useMemo(() => limitsFor(all, platform), [all, platform]);
}
