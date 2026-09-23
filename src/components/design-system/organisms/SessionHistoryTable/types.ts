import type { SessionMeta } from '@/types';

export interface SessionHistoryTableProps {
  sessions: SessionMeta[];
  /** Start of the span the list covers (the oldest session), for the "since …" label. */
  since: number | null;
  /** Days that span covers — bounds the transcript search window. */
  periodDays: number;
  onExport?: () => SessionMeta[];
  /** Drop the per-row surface badge — redundant when every row is that surface
   *  already (the Codex platform), noise rather than information. */
  hideSourceBadge?: boolean;
  /** "threads" under the Codex platform, "sessions" otherwise. */
  noun?: string;
}
