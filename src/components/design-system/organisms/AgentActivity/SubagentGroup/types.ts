import type { CompletedSubagentView, RunningSubagentView } from '@/lib/views/agents';

export interface SubagentGroupProps {
  label: string;
  running: RunningSubagentView[];
  completed: CompletedSubagentView[];
  wide?: boolean;
  enter?: boolean;
  className?: string;
}
