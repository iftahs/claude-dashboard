import type { SessionMeta, ProjectStat } from '@/types';
import type { TagsApi } from '@/hooks/useTags';
import { buildProjectStats } from '../ProjectBreakdown/utils';
import type { TagGroup } from './types';

/** Sentinel tag for projects the user hasn't tagged. */
export const UNTAGGED = '';

/**
 * Group per-project cost/tokens by user tag. A project with multiple tags counts
 * toward each (mirroring LiteLLM's multi-tag attribution); untagged projects fall
 * into the UNTAGGED bucket. Tagged groups sort by cost desc, untagged last.
 */
export function groupByTag(
  sessions: SessionMeta[],
  projectCosts: ProjectStat[] | undefined,
  tags: TagsApi,
): TagGroup[] {
  const stats = buildProjectStats(sessions, projectCosts);
  const map = new Map<string, TagGroup>();

  const bump = (tag: string, cost: number, effectiveTokens: number, sessionCount: number) => {
    let g = map.get(tag);
    if (!g) {
      g = { tag, cost: 0, effectiveTokens: 0, projectCount: 0, sessionCount: 0 };
      map.set(tag, g);
    }
    g.cost += cost;
    g.effectiveTokens += effectiveTokens;
    g.projectCount += 1;
    g.sessionCount += sessionCount;
  };

  for (const s of stats) {
    const projTags = tags.tagsFor(s.path);
    if (projTags.length === 0) bump(UNTAGGED, s.cost, s.effectiveTokens, s.sessionCount);
    else for (const tag of projTags) bump(tag, s.cost, s.effectiveTokens, s.sessionCount);
  }

  return [...map.values()].sort((a, b) => {
    if (a.tag === UNTAGGED) return 1;
    if (b.tag === UNTAGGED) return -1;
    return b.cost - a.cost;
  });
}
