import type { SessionRowView } from '@/lib/views/sessions';

export interface SessionTableRowProps {
  row: SessionRowView;
  selected: boolean;
  onOpen: (sessionId: string) => void;
}
