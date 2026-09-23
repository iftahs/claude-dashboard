import type { ReactNode } from 'react';
import type { SubagentStats } from '@/types';

export interface AgentHistoryStripProps {
  /** /api/insights/subagents for one platform over `days`. */
  data: SubagentStats | null;
  loading?: boolean;
  error?: string | null;
  title: string;
  help: ReactNode;
  /** Window length in days (empty-state copy). */
  days: number;
  /** Stack the stats above the by-type bars — for a half-width slot (the Both view's side-by-side strips). */
  stacked?: boolean;
}

export interface MiniStatProps {
  label: string;
  value: string;
  sub?: string;
}

export interface TypeRow {
  type: string;
  label: string;
  count: number;
  /** Share of all spawns in the window, 0–100. */
  pct: number;
}
