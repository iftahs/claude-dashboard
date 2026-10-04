import type { ReactNode } from 'react';
import type { LiveAgentsData } from '@/lib/agents';
import type { AgentActivityLabels } from '@/lib/views/agents';

export interface AgentActivityProps {
  data: LiveAgentsData | null;
  loading?: boolean;
  /** Section title. Default: "Agents · live activity". */
  title?: string;
  /** Section InfoTip text. Defaults to the Claude Code explanation. */
  help?: ReactNode;
  /** Group and chip wording. Defaults to the Claude Code strings. */
  labels?: AgentActivityLabels;
}
