import type { ReactNode } from 'react';
import { ago } from './format';
import { windowName } from './limits';
import type { ActiveBlock, CodexLiveData, CodexWindow } from '@/types';

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

// A gate, not a meter — the provider only says whether the model can run right now (Codex premium models).
export interface PlanGateRow {
  label: string;
  status: string;
  tone: 'ok' | 'muted' | 'danger';
}

export const BLOCK_MS = 5 * 3600_000;
export const DEFAULT_BLOCK_LIMIT = 6000000; // 6.0M effective tokens

export function formatRemaining(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  if (mins <= 0) return '0m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (remMins === 0) return `${hrs}h`;
  return `${hrs}h ${remMins}m`;
}

/** "~15m" / "~2h 5m" for a minute count. */
export function formatMins(mins: number): string {
  return mins < 60 ? `~${mins}m` : `~${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export const CLAUDE_GAUGE_LABELS: BlockGaugeLabels = {
  title: 'Claude Code · block usage',
  apiTitle: 'Claude Code · spend this block',
  help: "The ring is the live % of your account's 5-hour limit from Claude.ai (every device). The rows cover the current 5-hour block of your most recent Claude Code session, from local logs: a block opens at its first message, and the first message after it ends opens the next (how Anthropic starts a 5h window). Tokens are effective tokens (input + output + cache writes). The limit ETA extrapolates the live % at its average pace since the window opened.",
  apiHelp:
    "Estimated cost of your current 5-hour usage block in your most recent session: a window opens at its first message, and the first message after it ends opens the next. Dollar figures use Anthropic's published API rates and are computed from local logs. The ring fills against your daily spending cap when one is set in ⚙ Settings.",
  apiBadge: 'Current 5-hour session · estimated from local logs',
  liveBadge: 'Live from Claude.ai',
  livePulse: true,
  expiredBadge: '⚠️ Token expired — hover for the fix',
  offlineBadge: '⚠️ Local logs only (hover for details)',
  connectingBadge: 'Local logs (connecting to Claude.ai...)',
  current: 'This session',
  previous: 'Prev session',
};

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

/** BlockGauge wording for Codex — no Claude block, session or slash-command vocabulary. */
export function codexGaugeLabels(live: CodexLiveData | null | undefined, windowSec: number): Partial<BlockGaugeLabels> {
  const name = windowName(windowSec);
  const passive = !!live && !live.error && live.origin === 'passive';
  const snapAt = live?.snapshotAt ? Date.parse(live.snapshotAt) : NaN;
  return {
    title: `Codex · ${name} window`,
    apiTitle: `Codex · spend this ${name} window`,
    help: `The ring is the live % of your ChatGPT plan's ${name} Codex window, from OpenAI's usage API (offline: the newest local rollout snapshot). The rows count this window's effective tokens (input + output) on this machine; the previous window is the equally long stretch before it. The limit ETA extrapolates the live % at its average pace since the window opened. ${CODEX_COVERAGE}`,
    apiHelp: `Estimated cost of your Codex usage in the current ${name} window, at OpenAI's list API prices, from local rollouts — you are signed in with an API key, so there are no plan windows. The ring fills against your daily spending cap when one is set in ⚙ Settings.`,
    apiBadge: 'API key · estimated from local rollouts',
    liveBadge: passive ? `Snapshot · ${Number.isNaN(snapAt) ? 'age unknown' : ago(snapAt)}` : 'Live from ChatGPT',
    livePulse: !passive,
    expiredBadge: '⚠️ Codex token expired — open the ChatGPT app',
    offlineBadge: '⚠️ Local rollouts only (hover for details)',
    connectingBadge: 'Local rollouts (connecting to ChatGPT...)',
    current: 'This window',
    previous: 'Prev window',
  };
}
