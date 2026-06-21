import type { WorkflowsData, WorkflowRun } from '@/types';

export interface WorkflowsViewProps {
  data: WorkflowsData | null;
  loading?: boolean;
}

export interface WorkflowCardProps {
  run: WorkflowRun;
}
