import { compact } from '@/lib/format';
import type { Platform } from '@/hooks/useSource';
import type { SubagentStats } from '@/types';
import type { StatTile } from './types';

/**
 * The panel's tiles per platform. Counts only: the delegation / auto-review RATE
 * is the Insights KPI row's. Codex's guardian reviews are counted one per verdict.
 */
export function statTiles(d: SubagentStats, platform: Platform): StatTile[] {
  const spawns: StatTile = { label: 'Subagent spawns', value: compact(d.delegation.spawns) };
  const reviews: StatTile = { label: 'Guardian reviews', value: compact(d.autoReview.reviews) };
  if (platform === 'claude') {
    return [spawns, { label: 'Avg per delegating session', value: d.delegation.avgPerSession.toFixed(1) }];
  }
  if (platform === 'codex') {
    return [
      reviews,
      { label: 'Denied', value: compact(d.autoReview.denials), tone: d.autoReview.denials > 0 ? 'text-amber-400' : undefined },
      { label: 'Avg per reviewed thread', value: d.autoReview.avgPerSession.toFixed(1) },
      // Codex's non-guardian subagents (/review, spawned threads) are real delegation.
      ...(d.delegation.spawns > 0 ? [{ label: 'Other subagents', value: compact(d.delegation.spawns) }] : []),
    ];
  }
  return [spawns, reviews];
}

/** Spawn-type badge text: the guardian's internal id reads as words. */
export function typeLabel(type: string): string {
  return type === 'guardian_review' ? 'guardian review' : type;
}
