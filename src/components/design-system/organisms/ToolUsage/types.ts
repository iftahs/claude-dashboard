import type { ToolShare } from '@/types';

export interface ToolUsageProps {
  tools: ToolShare[];
  totalCalls: number;
  /** Window length for the caption (defaults to 7). */
  days?: number;
  /** Rows shown (defaults to 8). */
  limit?: number;
}
