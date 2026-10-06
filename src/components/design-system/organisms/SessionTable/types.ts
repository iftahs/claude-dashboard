import type { SessionTableView } from '@/lib/views/sessions';

export interface SessionTableProps {
  view: SessionTableView;
  onOpen: (sessionId: string) => void;
  onPageChange: (page: number) => void;
  className?: string;
}
