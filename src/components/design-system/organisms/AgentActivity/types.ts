import type { LiveSubagents } from '@/types';

export interface AgentActivityProps {
  data: LiveSubagents | null;
  loading?: boolean;
}
