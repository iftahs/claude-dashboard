import type { WorkflowAgentRowView } from '@/lib/views/workflows';

export interface WorkflowAgentRowProps {
  agent: WorkflowAgentRowView;
  onToggle: (agentId: string) => void;
  onRetry?: (agentId: string) => void;
}
