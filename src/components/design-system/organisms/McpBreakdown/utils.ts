import type { McpBreakdownView, McpSideView } from '@/lib/views/insights';
import type { McpSplitSegment } from './types';

export const LEGEND_LABEL = 'Tool call split';
export const TABLE_CAPTION = 'Calls and errors per MCP server';

const BUILTIN_COLOR = 'rgb(var(--fg-subtle))';
const MCP_COLOR = 'rgb(var(--info))';

function segment(key: string, side: McpSideView, color: string): McpSplitSegment {
  return { key, label: side.label, color, percent: side.percent, value: `${side.count} · ${side.share}` };
}

export function splitSegments(view: McpBreakdownView): McpSplitSegment[] {
  return [segment('builtin', view.builtin, BUILTIN_COLOR), segment('mcp', view.mcp, MCP_COLOR)];
}

export function splitLabel(view: McpBreakdownView): string {
  return `${view.builtin.label} ${view.builtin.share}, ${view.mcp.label} ${view.mcp.share}`;
}
