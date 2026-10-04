import type { SessionMeta, ProjectStat } from '@/types';
import { projectName } from '@/lib/project';
import { chatFolder } from '../SessionHistoryTable/utils';
import type { LocalProjectStat, ProjectPlatform } from './types';

export const normalizePath = (p: string) => p.toLowerCase().replace(/[^a-z0-9]/g, '');

// A desktop-app scratch folder (chat-only conversation) reads "Codex chat · <title>" / "Claude chat · <title>".
function projectLabel(path: string, sessions: SessionMeta[]): string {
  const chat = chatFolder(path, sessions[0]?.source);
  if (!chat) return projectName(path);
  const titled = sessions.filter((s) => s.title);
  return `${chat.app} chat · ${titled.length === 1 ? titled[0].title : chat.slug}`;
}

// Shared by ProjectBreakdown and TagBreakdown so both agree on totals; Claude/Codex share project paths, so under Both one repo is one row.
export function buildProjectStats(
  sessions: SessionMeta[],
  projectCosts?: ProjectStat[],
): LocalProjectStat[] {
  // Cost lookup keyed by normalized project name AND full path for robust matching.
  const costByName = new Map<string, number>();
  for (const p of projectCosts ?? []) {
    costByName.set(normalizePath(p.name), p.cost);
    costByName.set(normalizePath(p.path), p.cost);
  }

  const byPath = new Map<string, SessionMeta[]>();
  for (const s of sessions) {
    if (!s.project_path) continue;
    const list = byPath.get(s.project_path);
    if (list) list.push(s);
    else byPath.set(s.project_path, [s]);
  }

  const out: LocalProjectStat[] = [];
  for (const [path, list] of byPath) {
    const stat: LocalProjectStat = {
      path,
      name: projectLabel(path, list),
      activeMs: 0,
      effectiveTokens: 0,
      cacheReadTokens: 0,
      filesModified: 0,
      linesAdded: 0,
      linesRemoved: 0,
      sessionCount: list.length,
      claudeSessions: 0,
      codexSessions: 0,
      cost: costByName.get(normalizePath(path)) ?? costByName.get(normalizePath(projectName(path))) ?? 0,
    };
    for (const s of list) {
      stat.activeMs += s.active_ms ?? 0;
      stat.effectiveTokens += s.effective_tokens ?? (s.input_tokens ?? 0) + (s.output_tokens ?? 0);
      stat.cacheReadTokens += s.cache_read_tokens ?? 0;
      stat.filesModified += s.files_modified ?? 0;
      stat.linesAdded += s.lines_added ?? 0;
      stat.linesRemoved += s.lines_removed ?? 0;
      if (s.source === 'codex') stat.codexSessions++;
      else stat.claudeSessions++;
    }
    out.push(stat);
  }
  return out;
}

/** "3 sessions" / "2 threads" / "4 sessions · Claude 3 · Codex 1" (the Both view, mixed rows only). */
export function sessionCountLabel(p: LocalProjectStat, platform: ProjectPlatform): string {
  if (platform === 'codex') return `${p.sessionCount} thread${p.sessionCount !== 1 ? 's' : ''}`;
  const base = `${p.sessionCount} session${p.sessionCount !== 1 ? 's' : ''}`;
  if (platform === 'both' && p.claudeSessions > 0 && p.codexSessions > 0) {
    return `${base} · Claude ${p.claudeSessions} · Codex ${p.codexSessions}`;
  }
  return base;
}

export function projectsHelp(platform: ProjectPlatform): string {
  const base =
    'Per-project rollup of the sessions listed below — estimated cost, active time (prompt-to-answer, idle time excluded), effective tokens and files changed, one row per working directory. Sort with the buttons; tag projects to group their cost in Spend by Tag.';
  if (platform === 'codex') return `${base} Codex chat-only threads each get their own scratch folder, labelled with the thread title.`;
  if (platform === 'both') {
    return `${base} Claude and Codex sessions in the same folder share one row. Cowork sessions run in a sandbox with no host project, so they're excluded.`;
  }
  return `${base} Cowork sessions run in a sandbox with no host project, so they're excluded.`;
}
