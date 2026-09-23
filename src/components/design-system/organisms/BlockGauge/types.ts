import type { ReactNode } from 'react';
import type { ActiveBlock } from '@/types';

/**
 * The live utilisation the ring shows — one provider window, normalised so the
 * gauge does not care whose it is (Claude.ai's five_hour, Codex's 5-hour or weekly).
 */
export interface GaugeLive {
  /** 0–100. */
  pct: number;
  /** ISO reset time; null = no active window (it opens on the next message). */
  resetsAt: string | null;
}

/** Every platform-specific string on the card. Defaults are the Claude ones. */
export interface BlockGaugeLabels {
  /** Card title in plan mode. */
  title: string;
  /** Card title in API / pay-as-you-go mode. */
  apiTitle: string;
  /** InfoTip in plan mode. */
  help: ReactNode;
  /** InfoTip in API mode. */
  apiHelp: ReactNode;
  /** Status line in API mode (without a billing gateway). */
  apiBadge: string;
  /** Status line while live limits are flowing. */
  liveBadge: string;
  /** Pulse the live dot (false for a passive snapshot). */
  livePulse: boolean;
  /** Status line when the provider token has expired. */
  expiredBadge: string;
  /** Status line for any other live error. */
  offlineBadge: string;
  /** Status line before the first live reading arrives. */
  connectingBadge: string;
  /** Row label for the current block's local tokens ("This session" / "This window"). */
  current: string;
  /** Row label for the block before it ("Prev session" / "Prev window"). */
  previous: string;
}

export interface BlockGaugeProps {
  block: ActiveBlock | null;
  /** Live ring value; null/undefined falls back to the local estimate. */
  live?: GaugeLive | null;
  /** Why live limits are unavailable (drives the amber status line). */
  liveError?: string | null;
  /** API / pay-as-you-go mode — render an estimated-cost view instead of plan %. */
  isApi?: boolean;
  /** Estimated average $/day (used to fill the ring against a daily cap, if set). */
  costPerDay?: number;
  /** Daily USD cap from Settings, if configured. */
  dailyLimit?: number | null;
  /** Real billed cost so far today (from a LiteLLM gateway). When set, the daily-cap
   *  ring uses this instead of the estimated costPerDay. */
  todayActualCost?: number | null;
  /**
   * Effective tokens a block may hold, for the offline estimate. Defaults to the
   * Claude heuristic (6M); null = unknown — no % is guessed, the ring shows tokens.
   */
  blockLimit?: number | null;
  /** Length of the window the live % belongs to (default 5 h) — anchors the ETA. */
  windowMs?: number;
  /** Platform wording; anything left out keeps the Claude default. */
  labels?: Partial<BlockGaugeLabels>;
}
