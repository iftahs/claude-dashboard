import type { SessionMeta } from '@/types';
import { codexProjectLabel, projectName } from '@/lib/project';

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

/** Display name + optional surface badge for one session row. Code rows are
 *  unchanged (name only); Cowork keeps its literal "Cowork" name; Codex rows get
 *  a real project label plus a "Codex" badge. */
export function sessionLabel(s: SessionMeta): { name: string; badge: string | null } {
  if (s.source === 'cowork') return { name: 'Cowork', badge: null };
  if (s.source === 'codex') return { name: codexProjectLabel(s.project_path), badge: 'Codex' };
  return { name: projectName(s.project_path), badge: null };
}
