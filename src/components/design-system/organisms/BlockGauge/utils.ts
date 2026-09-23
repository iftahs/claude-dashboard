import type { BlockGaugeLabels } from './types';

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

/** API-mode help when a LiteLLM gateway supplies today's real spend (Claude only — the gateway proxies Anthropic). */
export const GATEWAY_API_HELP =
  'The big number is the estimated cost of your current 5-hour block (published API rates, from local logs). The daily-cap ring uses your real billed spend so far today from your LiteLLM gateway — see Spend vs caps below for the real today / week / month figures. Set a daily cap in ⚙ Settings.';

/** The Claude wording — what the card said before it served more than one platform. */
export const CLAUDE_GAUGE_LABELS: BlockGaugeLabels = {
  title: 'Claude Code · block usage',
  apiTitle: 'Claude Code · spend this block',
  help: "The ring is the live % of your account's 5-hour limit from Claude.ai (every device). The rows cover the current 5-hour block of your most recent Claude Code session, from local logs: a block opens at its first message, and the first message after it ends opens the next (how Anthropic starts a 5h window). Tokens are effective tokens (input + output + cache writes). The limit ETA extrapolates the live % at its average pace since the window opened.",
  apiHelp:
    "Estimated cost of your current 5-hour usage block in your most recent session: a window opens at its first message, and the first message after it ends opens the next. Dollar figures use Anthropic's published API rates and are computed from local logs. The ring fills against your daily spending cap when one is set in ⚙ Settings.",
  apiBadge: 'Current 5-hour session · estimated from local logs',
  liveBadge: 'Live from Claude.ai',
  livePulse: true,
  expiredBadge: '⚠️ Token expired — run any Claude Code cmd to refresh',
  offlineBadge: '⚠️ Local logs only (hover for details)',
  connectingBadge: 'Local logs (connecting to Claude.ai...)',
  current: 'This session',
  previous: 'Prev session',
};
