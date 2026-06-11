import type { SessionMeta } from '@/types';

export interface SessionHistoryTableProps {
  sessions: SessionMeta[];
  periodDays: number;
  onExport?: () => SessionMeta[];
}
