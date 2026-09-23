import type { ContribRow, ContribWindow } from '@/types';

export type ContribWindowKey = 'day' | 'week';

export type ContribBreakdownKey = keyof Pick<ContribWindow, 'skills' | 'subagents' | 'plugins' | 'mcpServers'>;

export interface LimitsContributorsProps {
  /**
   * Scope the panel to one platform explicitly (`?source=claude|codex`) — used side
   * by side under Both, where limits are per provider and a mixed breakdown means
   * nothing. Omitted: the header's scope (`withSrc`).
   */
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
