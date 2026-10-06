import type { McpBreakdownView } from '@/lib/views/insights';

export interface McpBreakdownProps {
  view: McpBreakdownView;
  className?: string;
}

export interface McpSplitSegment {
  key: string;
  label: string;
  color: string;
  percent: number;
  value: string;
}
