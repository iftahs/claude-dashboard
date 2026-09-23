import type { HistoryUnit, TypeRow } from './types';

/** The Agents tab's history window. /api/insights/subagents clamps days to 1–90. */
export const AGENT_HISTORY_DAYS = 30;

/** One accent for the by-type bars — the same indigo as the Insights Subagents card. */
export const TYPE_BAR_COLOR = '#6366f1';

// Subagent type keys as the scanners record them. Claude types are the Agent tool's
// `subagent_type` (already readable: "Explore", "Plan", …); Codex kinds come from the
// rollout's session_meta.source and read better spelled out.
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

export function historyUnit(platform: 'claude' | 'codex'): HistoryUnit {
  return platform === 'codex' ? 'thread' : 'session';
}

/** InfoTip copy per platform — what a "spawn" is differs, the stats do not. */
export function historyHelp(platform: 'claude' | 'codex', days: number): string {
  const what =
    platform === 'codex'
      ? `Subagent threads Codex spawned over the last ${days} days — one Guardian auto-review per approval verdict, plus delegated agents`
      : `Subagents Claude Code spawned (Agent/Task calls) over the last ${days} days`;
  const unit = historyUnit(platform);
  return `${what}: how many, how many per ${unit} that delegated, the share of ${unit}s that delegated at all, and which types did the work.`;
}
