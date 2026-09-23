import type { SubagentStats } from '@/types';
import type { Platform } from '@/hooks/useSource';

export interface SubagentStatsPanelProps {
  data: SubagentStats | null;
  /** Claude delegates to subagents; Codex's own spawn is the guardian auto-review. */
  platform: Platform;
}

/** One stat tile. */
export interface StatTile {
  label: string;
  value: string;
  /** Tailwind text colour of the value. */
  tone?: string;
}
