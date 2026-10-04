import type { TypeRow } from './types';

/** One accent for the by-type bars — the same indigo as the Insights Subagents card. */
export const TYPE_BAR_COLOR = '#6366f1';

// Claude types are the Agent tool's subagent_type (already readable); Codex kinds come from session_meta.source and read better spelled out.
const TYPE_LABELS: Record<string, string> = {
  guardian_review: 'Guardian review',
  guardian: 'Guardian review',
  review: 'Code review',
  thread_spawn: 'Spawned agent',
  'workflow-subagent': 'Workflow agent',
  'general-purpose': 'General purpose',
};

export function subagentTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/** The `n` busiest types with their share of all spawns, plus how many types are left over. */
export function topTypes(byType: Record<string, number>, n: number): { rows: TypeRow[]; rest: number } {
  const entries = Object.entries(byType).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  const rows = entries.slice(0, n).map(([type, count]) => ({
    type,
    label: subagentTypeLabel(type),
    count,
    pct: total > 0 ? (count / total) * 100 : 0,
  }));
  return { rows, rest: Math.max(0, entries.length - n) };
}
