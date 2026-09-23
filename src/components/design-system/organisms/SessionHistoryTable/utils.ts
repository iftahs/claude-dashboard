import type { SessionMeta, UsageSource } from '@/types';
import { codexProjectLabel, projectName } from '@/lib/project';
import type { SessionNoun } from './types';

export const ITEMS_PER_PAGE = 5;

/** 'session' / 'thread' ('Session' / 'Thread' when `capital`). */
export function singularNoun(noun: SessionNoun, capital = false): string {
  const one = noun === 'threads' ? 'thread' : 'session';
  return capital ? one[0].toUpperCase() + one.slice(1) : one;
}

export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/** "Sep 3" — the start of the span a "since …" label covers. */
export function sinceLabel(since: number | null): string {
  if (since === null) return '';
  return new Date(since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "<1m" / "45m" / "3h 12m" / "4d 6h" for a duration in milliseconds. */
export function formatDurationMs(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60_000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** "4s" / "1m 23s" for a short span (a single turn). */
export function formatTurnMs(ms: number): string {
  const s = Math.round(Math.max(0, ms) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Claude Desktop gives each chat its own scratch workspace, like the ChatGPT app's
// `Documents/Codex/<date>/<slug>`: `…/Claude/scratch-workspaces/<ids…>/scratch-<date>-<hash>`.
const CLAUDE_CHAT_DIR = /[\\/]Claude[\\/]scratch-workspaces[\\/](?:[^\\/]+[\\/])*(scratch-[^\\/]+)[\\/]?$/i;

/** The desktop app whose per-chat scratch folder `path` is, with the folder's slug; null for a real project. */
export function chatFolder(path: string, source: UsageSource | undefined): { app: 'Codex' | 'Claude'; slug: string } | null {
  if (!path) return null;
  if (source === 'codex') {
    return codexProjectLabel(path) !== projectName(path) ? { app: 'Codex', slug: projectName(path) } : null;
  }
  const m = path.match(CLAUDE_CHAT_DIR);
  return m ? { app: 'Claude', slug: m[1] } : null;
}

/** Display name + optional surface badge for one session row. Cowork keeps its
 *  literal "Cowork" name; a desktop chat's scratch folder reads "Codex chat" /
 *  "Claude chat" (its slug only when the session has no title to show instead);
 *  Codex rows get a "Codex" badge. */
export function sessionLabel(s: SessionMeta): { name: string; badge: string | null } {
  if (s.source === 'cowork') return { name: 'Cowork', badge: null };
  const badge = s.source === 'codex' ? 'Codex' : null;
  const chat = chatFolder(s.project_path, s.source);
  if (chat) return { name: s.title ? `${chat.app} chat` : `${chat.app} chat · ${chat.slug}`, badge };
  return { name: projectName(s.project_path), badge };
}

/** What the session was about: its title, else its first prompt. */
export function sessionHeadline(s: SessionMeta): string {
  return s.title || s.first_prompt || '';
}

/** Active time when the session recorded turns, else the wall-clock span. */
export function durationCell(s: SessionMeta): { text: string; tooltip: string; active: boolean } {
  const wall = formatDurationMs((s.duration_minutes ?? 0) * 60_000);
  if (s.active_ms === null || s.active_ms === undefined) {
    return { text: wall, tooltip: `Wall clock ${wall} (no turn timing recorded)`, active: false };
  }
  const active = formatDurationMs(s.active_ms);
  return { text: active, tooltip: `Active ${active} · wall clock ${wall}`, active: true };
}

export function sessionTokens(s: SessionMeta): number {
  return s.effective_tokens ?? (s.input_tokens ?? 0) + (s.output_tokens ?? 0);
}

/** Case-insensitive match on the title, first prompt or project path. */
export function matchesQuery(s: SessionMeta, query: string): boolean {
  const q = query.toLowerCase();
  if (!q) return true;
  return (
    !!s.title?.toLowerCase().includes(q) ||
    !!s.first_prompt?.toLowerCase().includes(q) ||
    !!s.project_path?.toLowerCase().includes(q)
  );
}

/**
 * Export rows. Titles and PR URLs stay out (a count only): they name customers
 * and private repos, and an export is the one thing that leaves the machine.
 */
export function exportRows(data: SessionMeta[]) {
  return data.map((s) => ({
    session_id: s.session_id,
    source: s.source ?? 'code',
    start_time: s.start_time,
    project: s.project_path,
    active_minutes: s.active_ms === null || s.active_ms === undefined ? '' : Math.round(s.active_ms / 60_000),
    wall_clock_minutes: s.duration_minutes,
    turns: s.turn_count ?? '',
    effective_tokens: sessionTokens(s),
    cache_read_tokens: s.cache_read_tokens ?? 0,
    files_modified: s.files_modified ?? 0,
    lines_added: s.lines_added ?? 0,
    lines_removed: s.lines_removed ?? 0,
    git_commits: s.git_commits,
    pull_requests: (s.pr_urls ?? []).length,
    first_prompt: s.first_prompt,
  }));
}

/** The JSON export: every field but the title and the PR URLs. */
export function exportJson(data: SessionMeta[]): Array<Omit<SessionMeta, 'title' | 'pr_urls'> & { pull_requests: number }> {
  return data.map(({ title: _title, pr_urls: prs, ...rest }) => ({ ...rest, pull_requests: prs?.length ?? 0 }));
}

/** "owner/repo#12" for a GitHub-style PR URL; the URL itself otherwise. */
export function prLabel(url: string): string {
  const m = url.match(/^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  return m ? `${m[1]}#${m[2]}` : url;
}
