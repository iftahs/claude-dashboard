import type { SessionMeta } from '@/types';

export interface SessionHistoryTableProps {
  sessions: SessionMeta[];
  periodDays: number;
  onExport?: () => SessionMeta[];
  /** Drop the per-row surface badge — redundant when every row is that surface
   *  already (the Codex platform), noise rather than information. */
  hideSourceBadge?: boolean;
}
