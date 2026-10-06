import type { BadgeTone } from '@/components/design-system/atoms/Badge/types';
import type { StatusDotTone } from '@/components/design-system/atoms/StatusDot/types';
import type { WorkflowPanesView } from '@/lib/views/workflows';

export type WorkflowPhaseSelectHandler = (runId: string, index: number) => void;

export type WorkflowAgentHandler = (runId: string, agentId: string) => void;

export interface WorkflowPhasePanesProps {
  view: WorkflowPanesView;
  onSelectPhase: WorkflowPhaseSelectHandler;
  onToggleAgent: WorkflowAgentHandler;
  onRetryAgent?: WorkflowAgentHandler;
  className?: string;
}

export interface AgentDotLook {
  tone: StatusDotTone;
  pulse: boolean;
  badge: BadgeTone | null;
}
