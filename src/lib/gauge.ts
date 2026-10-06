import { liveWindowEta } from './limits';
import type { ActiveBlock, CodexLiveData, CodexWindow } from '@/types';

// Normalised so the gauge does not care whose window it is (Claude.ai's five_hour, Codex's 5-hour or weekly).
export interface GaugeLive {
  /** 0–100. */
  pct: number;
  /** ISO reset time; null = no active window (it opens on the next message). */
  resetsAt: string | null;
}

export const BLOCK_MS = 5 * 3600_000;
export const DEFAULT_BLOCK_LIMIT = 6000000; // 6.0M effective tokens

/** "~15m" / "~2h 5m" for a minute count. */
export function formatMins(mins: number): string {
  return mins < 60 ? `~${mins}m` : `~${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** What the Codex numbers cover — shared by the plan card and the gauge InfoTips. */
export const CODEX_COVERAGE =
  "Local figures come from the Codex rollouts the ChatGPT desktop app writes under ~/.codex — every thread run on this machine, with each turn's Guardian auto-review folded into its parent thread. Codex usage from the ChatGPT mobile and web apps never reaches this machine: it moves the % used, but not the local token counts. Costs are estimates at OpenAI's list API prices (a plan has no per-token bill).";

/** Error strings containing "expired" mean the local Codex token lapsed (see server/codex-live.ts). */
export function isTokenExpired(err: string): boolean {
  return /expired/i.test(err);
}

/** The window the Codex gauge rings: the 5-hour one, else the weekly one ('go' plan). */
export function codexGaugeWindow(live: CodexLiveData | null | undefined): CodexWindow | null {
  if (!live || live.error) return null;
  return live.fiveHour ?? live.weekly;
}

/** The Codex gauge's live ring value, or null when the limits could not be read. */
export function codexGaugeLive(live: CodexLiveData | null | undefined): GaugeLive | null {
  const w = codexGaugeWindow(live);
  return w ? { pct: w.usedPct, resetsAt: w.resetsAt } : null;
}

export interface GaugeInput {
  block: ActiveBlock | null;
  live: GaugeLive | null;
  isApi: boolean;
  costPerDay: number;
  dailyLimit: number | null;
  todayActualCost: number | null;
  // null = unknown: the reading carries raw tokens instead of a guessed %.
  blockLimit: number | null;
  windowMs: number;
  now: number;
}

export type GaugePaceTone = 'danger' | 'warning' | 'neutral';

export interface GaugeReading {
  hasLive: boolean;
  effective: number;
  prevEffective: number;
  cacheReads: number;
  cost: number;
  prevCost: number;
  capPct: number | null;
  tokPct: number | null;
  noActiveBlock: boolean;
  startsAt: number | null;
  resetsAt: number;
  burnRatePerHour: number;
  burnCostPerHour: number;
  minsUntilLimit: number | null;
  projectedPct: number | null;
  paceTone: GaugePaceTone;
}

export function gaugeReading({
  block,
  live,
  isApi,
  costPerDay,
  dailyLimit,
  todayActualCost,
  blockLimit,
  windowMs,
  now,
}: GaugeInput): GaugeReading {
  const hasLive = !isApi && !!live;

  const blockEnded = !!block && (!block.isActive || block.resetsAt <= now);
  const current = blockEnded ? null : block?.totals;
  const previous = blockEnded ? block?.totals : block?.prevTotals;
  const effective = current?.effectiveTokens ?? 0;
  const prevEffective = previous?.effectiveTokens ?? 0;
  const cacheReads = current?.cacheReadTokens ?? 0;
  const cost = current?.cost ?? 0;
  const prevCost = previous?.cost ?? 0;

  const dailySpend = todayActualCost ?? costPerDay;
  const capPct = isApi && dailyLimit ? Math.min(100, (dailySpend / dailyLimit) * 100) : null;
  const tokPct = hasLive ? live!.pct : blockLimit ? Math.min(100, (effective / blockLimit) * 100) : null;

  const liveResetsAt = hasLive && live!.resetsAt ? Date.parse(live!.resetsAt) : NaN;
  const liveWindow = !Number.isNaN(liveResetsAt);
  const noActiveBlock = hasLive ? live!.resetsAt == null : blockEnded;
  const resetsAt = liveWindow ? liveResetsAt : block?.resetsAt ?? now + windowMs;
  const startsAt = liveWindow ? liveResetsAt - windowMs : block && !blockEnded ? block.start : null;

  const elapsedMs = Math.max(60_000, now - (block?.start ?? now));
  const burnRatePerHour = effective > 0 ? Math.round((effective / elapsedMs) * 3600_000) : 0;
  const burnCostPerHour = cost > 0 ? (cost / elapsedMs) * 3600_000 : 0;

  let minsUntilLimit: number | null = null;
  let projectedPct: number | null = null;
  if (hasLive && liveWindow) {
    ({ minsUntilLimit, projectedPct } = liveWindowEta(live!.pct, liveResetsAt, windowMs, now));
  } else if (!hasLive && blockLimit && burnRatePerHour > 0) {
    minsUntilLimit = Math.round((Math.max(0, blockLimit - effective) / burnRatePerHour) * 60);
  }

  const paceTone: GaugePaceTone =
    isApi || minsUntilLimit === null ? 'neutral' : minsUntilLimit < 30 ? 'danger' : minsUntilLimit < 60 ? 'warning' : 'neutral';

  return {
    hasLive,
    effective,
    prevEffective,
    cacheReads,
    cost,
    prevCost,
    capPct,
    tokPct,
    noActiveBlock,
    startsAt,
    resetsAt,
    burnRatePerHour,
    burnCostPerHour,
    minsUntilLimit,
    projectedPct,
    paceTone,
  };
}
