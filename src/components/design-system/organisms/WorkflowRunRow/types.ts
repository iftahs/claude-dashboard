import type {
  WorkflowAgentHandler,
  WorkflowPhaseSelectHandler,
} from '@/components/design-system/organisms/WorkflowPhasePanes/types';
import type { WorkflowRecentRunView } from '@/lib/views/workflows';

export interface WorkflowRunRowProps {
  view: WorkflowRecentRunView;
  onToggle: (runId: string) => void;
  onSelectPhase: WorkflowPhaseSelectHandler;
  onToggleAgent: WorkflowAgentHandler;
  onRetryAgent?: WorkflowAgentHandler;
  className?: string;
}
