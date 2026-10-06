import type { WorkflowAgentDetailView } from '@/lib/views/workflows';

export interface WorkflowAgentDetailProps {
  detail: WorkflowAgentDetailView;
  onRetry?: () => void;
}
