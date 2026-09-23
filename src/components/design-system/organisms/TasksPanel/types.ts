import type { WorkspaceTasksData } from '@/types';

export interface TasksPanelProps {
  data: WorkspaceTasksData | null;
  /** Shown in the Tasks column when there are none (e.g. a platform with no task tracker). */
  emptyTasks?: string;
}
