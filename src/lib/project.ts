import type { ProjectStat, SessionMeta, UsageSource } from '@/types';

/**
 * Project display names derived from filesystem paths. Shared by the Sessions
 * table and the Codex views so both surfaces label a thread's working directory
 * the same way. Only the last path segment ever reaches the screen — never the
 * full path.
 */

/** Last path segment of a project path ("C:\\dev\\my-app" → "my-app"). */
export function projectName(path: string): string {
  if (!path) return 'unknown';
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

// The ChatGPT desktop app gives each chat-only Codex thread a scratch folder,
// `…/Documents/Codex/<date>/<slug>` — the slug is the only meaningful part.
const CODEX_CHAT_DIR = /[\\/]Documents[\\/]Codex[\\/][^\\/]+[\\/]([^\\/]+)[\\/]?$/i;

/** Project label for a Codex thread: "Codex chat · <slug>" for the desktop
 *  scratch folders, otherwise the ordinary last-segment project name. */
export function codexProjectLabel(path: string): string {
  const m = path?.match(CODEX_CHAT_DIR);
  return m ? `Codex chat · ${m[1]}` : projectName(path);
}

// Matches the Claude Desktop scratch-workspace path, e.g. `.../Claude/scratch-workspaces/<ids>/scratch-<date>-<hash>`.
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

export interface LocalProjectStat {
  path: string;
  /** Display label: last path segment; a Codex chat folder shows its thread title. */
  name: string;
  /** Sum of the sessions' active time (turn durations), ms. */
  activeMs: number;
  effectiveTokens: number;
  cacheReadTokens: number;
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  sessionCount: number;
  claudeSessions: number;
  codexSessions: number;
  cost: number;
  /** The listed sessions of this project, costliest first. */
  sessions: SessionMeta[];
}

/** Case-insensitive, separator-agnostic key for a full project path. */
export const pathKey = (p: string) => p.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');

const NO_SESSIONS: SessionMeta[] = [];

// A desktop-app scratch folder (chat-only conversation) reads "Codex chat · <title>" / "Claude chat · <title>".
function projectLabel(path: string, sessions: SessionMeta[]): string {
  const chat = chatFolder(path, sessions[0]?.source);
  if (!chat) return projectName(path);
  const titled = sessions.filter((s) => s.title);
  return `${chat.app} chat · ${titled.length === 1 ? titled[0].title : chat.slug}`;
}

// Shared by ProjectBreakdown and TagBreakdown so both agree on totals. One row per /api/projects entry, which owns cost, tokens and session count; the session list only adds active time, files, lines and the chat label.
export function buildProjectStats(sessions: SessionMeta[], projects: ProjectStat[]): LocalProjectStat[] {
  const byKey = new Map<string, SessionMeta[]>();
  for (const s of sessions) {
    if (!s.project_path) continue;
    const key = pathKey(s.project_path);
    const list = byKey.get(key);
    if (list) list.push(s);
    else byKey.set(key, [s]);
  }

  return projects.map((project) => {
    const key = pathKey(project.path);
    const list = byKey.get(key) ?? NO_SESSIONS;
    byKey.delete(key); // two server paths that differ only in case must not both claim the same sessions
    const stat: LocalProjectStat = {
      path: project.path,
      name: projectLabel(project.path, list),
      activeMs: 0,
      effectiveTokens: project.effectiveTokens,
      cacheReadTokens: 0,
      filesModified: 0,
      linesAdded: 0,
      linesRemoved: 0,
      sessionCount: project.sessionCount,
      claudeSessions: 0,
      codexSessions: 0,
      cost: project.cost,
      sessions: list.length > 1 ? [...list].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0)) : list,
    };
    for (const s of list) {
      stat.activeMs += s.active_ms ?? 0;
      stat.cacheReadTokens += s.cache_read_tokens ?? 0;
      stat.filesModified += s.files_modified ?? 0;
      stat.linesAdded += s.lines_added ?? 0;
      stat.linesRemoved += s.lines_removed ?? 0;
      if (s.source === 'codex') stat.codexSessions++;
      else stat.claudeSessions++;
    }
    return stat;
  });
}
