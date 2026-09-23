import type { ContribRow, ContribWindow } from '@/types';

export type ContribWindowKey = 'day' | 'week';

export type ContribBreakdownKey = keyof Pick<ContribWindow, 'skills' | 'subagents' | 'plugins' | 'mcpServers'>;

export interface LimitsContributorsProps {
  /** Explicit platform scope, for side-by-side use under Both; omitted falls back to the header's scope (`withSrc`). */
  source?: 'claude' | 'codex';
  /** Keep the card (with an empty-state line) when nothing crosses the threshold, so a side-by-side pair stays aligned. */
  showEmpty?: boolean;
}

export interface BreakdownTableProps {
  label: string;
  rows: ContribRow[];
  color: string;
  /** Display name for a row (e.g. 'guardian_review' → 'Guardian auto-review'). */
  nameOf?: (name: string) => string;
}
