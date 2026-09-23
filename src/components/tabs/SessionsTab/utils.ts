import { compact } from '@/lib/format';
import type { Platform } from '@/hooks/useSource';
import type { TagMove } from '@/hooks/useTags';
import type { ProjectStat, SessionSummary, SessionSummaryPart } from '@/types';
import { formatDurationMs, formatTurnMs, sinceLabel } from '@/components/design-system/organisms/SessionHistoryTable/utils';

export interface SummaryCard {
  key: string;
  label: string;
  value: string;
  sub: string;
  /** "Claude … · Codex …" under Both; null otherwise. */
  split: string | null;
  help: string;
}

export function sessionNoun(platform: Platform): 'sessions' | 'threads' {
  return platform === 'codex' ? 'threads' : 'sessions';
}

function lines(p: SessionSummaryPart): string {
  return `+${compact(p.linesAdded)} / −${compact(p.linesRemoved)}`;
}

function split(summary: SessionSummary, platform: Platform, fmt: (p: SessionSummaryPart) => string): string | null {
  if (platform !== 'both' || summary.claude.sessions === 0 || summary.codex.sessions === 0) return null;
  return `Claude ${fmt(summary.claude)} · Codex ${fmt(summary.codex)}`;
}

// Each card is computed over exactly the sessions the table below lists (not a separate window).
export function summaryCards(summary: SessionSummary, platform: Platform): SummaryCard[] {
  const t = summary.total;
  const noun = sessionNoun(platform);
  const since = sinceLabel(t.since);
  const agent = platform === 'codex' ? 'Codex' : platform === 'claude' ? 'Claude' : 'the agent';
  return [
    {
      key: 'sessions',
      label: platform === 'codex' ? 'Threads' : 'Sessions',
      value: t.sessions.toLocaleString(),
      sub: since ? `since ${since}` : 'none yet',
      split: split(summary, platform, (p) => p.sessions.toLocaleString()),
      help: `${platform === 'codex' ? 'Codex threads' : 'Sessions'} in the history below — every one still on disk (or kept by the history archive), subagent-only runs excluded.`,
    },
    {
      key: 'longest',
      label: `Longest active ${noun === 'threads' ? 'thread' : 'session'}`,
      value: t.longestSessionId ? formatDurationMs(t.longestActiveMs) : '—',
      sub: t.longestLabel || '—',
      split: split(summary, platform, (p) => (p.longestSessionId ? formatDurationMs(p.longestActiveMs) : '—')),
      help: `The ${noun === 'threads' ? 'thread' : 'session'} with the most active time: the sum of its turns, each from your prompt to ${agent}'s last reply before the next one. Idle time between turns is not counted, unlike the wall-clock span.`,
    },
    {
      key: 'turn',
      label: 'Median turn time',
      value: t.medianTurnMs === null ? '—' : formatTurnMs(t.medianTurnMs),
      sub: `over ${t.turnCount.toLocaleString()} turn${t.turnCount !== 1 ? 's' : ''}`,
      split: split(summary, platform, (p) => (p.medianTurnMs === null ? '—' : formatTurnMs(p.medianTurnMs))),
      help: `How long a typical turn takes — from a prompt until ${agent} finishes working on it (tool calls included). Half of all turns are faster than this.`,
    },
    {
      key: 'lines',
      label: 'Lines changed',
      value: lines(t),
      sub: 'added / removed',
      split: split(summary, platform, lines),
      help: `Lines added and removed by file edits in these ${noun}, subagents included — counted from each edit's diff. Failed or declined edits changed nothing and are not counted.`,
    },
  ];
}

/** Old project paths → current ones, from /api/projects, for useTags().migrate. */
export function tagMovesFrom(projects: ProjectStat[] | undefined): TagMove[] {
  const moves: TagMove[] = [];
  for (const p of projects ?? []) for (const from of p.legacyPaths ?? []) moves.push({ from, to: p.path });
  return moves;
}
