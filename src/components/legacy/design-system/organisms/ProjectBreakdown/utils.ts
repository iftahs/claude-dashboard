import type { LocalProjectStat } from '@/lib/project';
import type { ProjectPlatform } from './types';

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
