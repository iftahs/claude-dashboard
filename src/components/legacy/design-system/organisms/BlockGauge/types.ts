import type { ReactNode } from 'react';
import type { ActiveBlock } from '@/types';

// Normalised so the gauge does not care whose window it is (Claude.ai's five_hour, Codex's 5-hour or weekly).
export interface GaugeLive {
  /** 0–100. */
  pct: number;
  /** ISO reset time; null = no active window (it opens on the next message). */
  resetsAt: string | null;
}

/** Every platform-specific string on the card. Defaults are the Claude ones. */
export interface BlockGaugeLabels {
  title: string;
  apiTitle: string;
  help: ReactNode;
  apiHelp: ReactNode;
  apiBadge: string;
  liveBadge: string;
  /** Pulse the live dot (false for a passive snapshot). */
  livePulse: boolean;
  expiredBadge: string;
  offlineBadge: string;
  connectingBadge: string;
  /** "This session" / "This window". */
  current: string;
  /** "Prev session" / "Prev window". */
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
  /** Defaults to the Claude heuristic (6M); null = unknown, ring shows raw tokens instead of a guessed %. */
  blockLimit?: number | null;
  /** Length of the window the live % belongs to (default 5 h) — anchors the ETA. */
  windowMs?: number;
  /** Platform wording; anything left out keeps the Claude default. */
  labels?: Partial<BlockGaugeLabels>;
}
