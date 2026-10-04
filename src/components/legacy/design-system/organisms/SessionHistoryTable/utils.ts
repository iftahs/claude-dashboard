import type { SessionMeta } from '@/types';
import { chatFolder, projectName } from '@/lib/project';
import { formatDurationMs, sessionTokens } from '@/lib/sessions';

export const ITEMS_PER_PAGE = 5;

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

// A desktop chat's scratch folder reads "Codex chat" / "Claude chat" (slug only when there's no title).
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

// Titles and PR URLs stay out (a count only) — they name customers and private repos, and an export leaves the machine.
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
