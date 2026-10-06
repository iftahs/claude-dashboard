import type { SessionSearchView } from '@/lib/views/sessions';

export interface SessionSearchStripProps {
  view: SessionSearchView;
  onQueryChange: (query: string) => void;
  onOpen: (sessionId: string) => void;
  className?: string;
}
