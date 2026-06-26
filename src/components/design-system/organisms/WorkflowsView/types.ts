import type { WorkflowsData, WorkflowRun, WorkflowStats } from '@/types';

export interface WorkflowsViewProps {
  data: WorkflowsData | null;
  loading?: boolean;
  stats?: WorkflowStats | null;
  statsLoading?: boolean;
}

export interface WorkflowCardProps {
  run: WorkflowRun;
}
