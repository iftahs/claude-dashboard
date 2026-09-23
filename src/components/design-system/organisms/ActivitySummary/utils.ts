import type { Platform } from '@/hooks/useSource';
import { compact, longDateLabel } from '@/lib/format';
import type { UsageSummary, UsageSummaryData } from '@/types';
import type { SummaryCard } from './types';

/** "Aug 10, 2026" for a local YYYY-MM-DD key (read as a calendar date, not a timestamp). */
function dayKeyLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return y && m && d ? longDateLabel(new Date(y, m - 1, d).getTime()) : key;
}

/** "Claude X · Codex Y" — the Both platform's split line; null when there is no split. */
function split(s: UsageSummaryData, fmt: (p: UsageSummary) => string): string | null {
  const bp = s.byPlatform;
  if (!bp) return null;
  return `Claude ${bp.claude.firstEventTs == null ? '—' : fmt(bp.claude)} · Codex ${
    bp.codex.firstEventTs == null ? '—' : fmt(bp.codex)
  }`;
}

/** Why "lifetime" only reaches back so far, in the platform's own terms. */
function retentionNote(platform: Platform): string {
  if (platform === 'codex') return 'It covers the Codex rollouts on this machine, from the first one.';
  const claude =
    'Claude Code deletes transcripts after ~30 days unless the history archive (DASHBOARD_RETAIN_HISTORY=1) is on, so for Claude this is the history still on disk, not the account lifetime.';
  return platform === 'both' ? `${claude} Codex covers the rollouts on this machine.` : claude;
}

/**
 * The four Activity-summary cards — identical labels on every platform, values
 * from /api/usage/summary. Under Codex (and Both) the lifetime card adds OpenAI's
 * server-side count; under Both each card adds the Claude / Codex split.
 */
export function summaryCards(
  s: UsageSummaryData,
  platform: Platform,
  codexServerLifetime: number | null | undefined,
): SummaryCard[] {
  const since = s.firstEventTs != null ? `since ${longDateLabel(s.firstEventTs)}` : 'no usage yet';
  const codexLocalTotal =
    platform === 'codex' ? s.lifetimeTotalTokens : platform === 'both' ? s.byPlatform?.codex.lifetimeTotalTokens : undefined;
  const serverLine =
    platform !== 'claude' && codexServerLifetime != null && codexServerLifetime > 0
      ? `OpenAI ${compact(codexServerLifetime)} vs local ${compact(codexLocalTotal ?? 0)} (all tokens)`
      : null;
  const bothSplit = platform === 'both';
  const activePct = s.spanDays > 0 ? Math.round((s.activeDays / s.spanDays) * 100) : 0;

  return [
    {
      key: 'lifetime',
      label: 'Lifetime tokens',
      value: compact(s.lifetimeEffectiveTokens),
      sub: since,
      extra: bothSplit ? split(s, (p) => compact(p.lifetimeEffectiveTokens)) : serverLine,
      help: `Effective tokens (input + output + cache writes, cache reads excluded) over every usage event in the logs. ${retentionNote(platform)}${
        platform !== 'claude'
          ? " OpenAI's figure is its own lifetime count for the account — every device, every token incl. cached input — so it is compared with the local all-token sum, not the effective figure."
          : ''
      }`,
    },
    {
      key: 'peak',
      label: 'Peak day',
      value: s.peakDay ? compact(s.peakDay.effectiveTokens) : '—',
      sub: s.peakDay ? dayKeyLabel(s.peakDay.date) : '—',
      extra: bothSplit ? split(s, (p) => (p.peakDay ? compact(p.peakDay.effectiveTokens) : '—')) : null,
      help: 'The local calendar day with the most effective tokens in the logs — the busiest day on record.',
    },
    {
      key: 'streak',
      label: 'Current streak',
      value: `${s.currentStreakDays}d`,
      sub: `longest ${s.longestStreakDays}d`,
      extra: bothSplit ? split(s, (p) => `${p.currentStreakDays}d`) : null,
      help: "Consecutive local calendar days with any usage, ending today (or yesterday, until today's first message). Longest is the longest such run in the logs.",
    },
    {
      key: 'active',
      label: 'Active days',
      value: s.activeDays.toLocaleString(),
      sub: s.spanDays > 0 ? `of ${s.spanDays.toLocaleString()} days · ${activePct}%` : '—',
      extra: bothSplit ? split(s, (p) => p.activeDays.toLocaleString()) : null,
      help: 'Local calendar days with at least one usage event, out of the days since the first one.',
    },
  ];
}
