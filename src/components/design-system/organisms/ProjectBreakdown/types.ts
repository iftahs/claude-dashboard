import type { ProjectBreakdownView, ProjectSort } from '@/lib/views/sessions';

export type ProjectTagsHandler = (path: string, tags: string[]) => void;

export interface ProjectBreakdownProps {
  view: ProjectBreakdownView;
  onSortChange: (sort: ProjectSort) => void;
  onTagsChange: ProjectTagsHandler;
  className?: string;
}
