import type { SessionMeta, ProjectStat } from '@/types';
import type { LocalProjectStat } from './types';

export const normalizePath = (p: string) => p.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Roll session metadata (+ /api/projects cost) up into one LocalProjectStat per
 * project path. Shared by ProjectBreakdown (sorted rows) and TagBreakdown
 * (grouped by user tag) so both agree on per-project cost/token totals.
 */
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

  const map = new Map<string, LocalProjectStat>();
  for (const s of sessions) {
    if (!s.project_path) continue;
    const path = s.project_path;

    let stat = map.get(path);
    if (!stat) {
      const parts = path.split(/[\\/]/);
      const name = parts[parts.length - 1] || path;
      stat = {
        path,
        name,
        totalTimeMinutes: 0,
        effectiveTokens: 0,
        cacheReadTokens: 0,
        filesModified: 0,
        linesAdded: 0,
        linesRemoved: 0,
        sessionCount: 0,
        cost: 0,
      };
      map.set(path, stat);
    }

    stat.totalTimeMinutes += s.duration_minutes ?? 0;
    stat.effectiveTokens += s.effective_tokens ?? (s.input_tokens ?? 0) + (s.output_tokens ?? 0);
    stat.cacheReadTokens += s.cache_read_tokens ?? 0;
    stat.filesModified += s.files_modified ?? 0;
    stat.linesAdded += s.lines_added ?? 0;
    stat.linesRemoved += s.lines_removed ?? 0;
    stat.sessionCount += 1;
  }

  for (const stat of map.values()) {
    stat.cost =
      costByName.get(normalizePath(stat.path)) ?? costByName.get(normalizePath(stat.name)) ?? 0;
  }

  return [...map.values()];
}
