import type { InsightsMcp } from '@/types';
import type { Platform } from '@/hooks/useSource';

export interface McpBreakdownProps {
  data: InsightsMcp | null;
  /** Names whose built-in tools the split is against (Claude's, Codex's or each agent's). */
  platform: Platform;
}
