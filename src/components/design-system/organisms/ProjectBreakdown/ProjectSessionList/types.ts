import type { ProjectSessionList as ProjectSessionListView } from '@/lib/views/sessions';

export interface ProjectSessionListProps extends ProjectSessionListView {
  id: string;
  label: string;
  onOpen: (sessionId: string) => void;
}
