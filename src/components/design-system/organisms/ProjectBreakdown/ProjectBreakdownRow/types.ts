import type { ProjectRowView } from '@/lib/views/sessions';
import type { ProjectTagsHandler } from '../types';

export interface ProjectBreakdownRowProps {
  row: ProjectRowView;
  suggestions: readonly string[];
  onTagsChange: ProjectTagsHandler;
}
