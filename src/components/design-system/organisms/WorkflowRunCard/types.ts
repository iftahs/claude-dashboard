import type {
  WorkflowAgentHandler,
  WorkflowPhaseSelectHandler,
} from '@/components/design-system/organisms/WorkflowPhasePanes/types';
import type { WorkflowLiveRunView } from '@/lib/views/workflows';

export interface WorkflowRunCardProps {
  view: WorkflowLiveRunView;
  onSelectPhase: WorkflowPhaseSelectHandler;
  onToggleAgent: WorkflowAgentHandler;
  onRetryAgent?: WorkflowAgentHandler;
  className?: string;
}
