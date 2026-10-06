import type { WorkflowPhaseView } from '@/lib/views/workflows';

export interface WorkflowPhaseItemProps {
  phase: WorkflowPhaseView;
  onSelect: (index: number) => void;
}
