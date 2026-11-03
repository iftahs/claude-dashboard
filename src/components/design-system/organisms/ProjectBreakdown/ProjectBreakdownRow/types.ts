import type { ProjectRowView } from '@/lib/views/sessions';
import type { ProjectTagsHandler } from '../types';

export interface ProjectBreakdownRowProps {
  row: ProjectRowView;
  noun: string;
  suggestions: readonly string[];
  onTagsChange: ProjectTagsHandler;
  onOpenSession: (sessionId: string) => void;
}
