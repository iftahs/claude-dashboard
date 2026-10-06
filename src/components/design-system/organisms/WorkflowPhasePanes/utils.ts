import type { WorkflowFactTone, WorkflowPhaseState } from '@/lib/views/workflows';
import type { WorkflowAgentState } from '@/types';
import type { AgentDotLook } from './types';

export const PHASE_STATE_LABEL: Record<WorkflowPhaseState, string> = {
  done: 'Done',
  running: 'Running',
  partial: 'Not finished',
  pending: 'Not started',
};

export const AGENT_DOT_LOOK: Record<Exclude<WorkflowAgentState, 'done' | 'error'>, AgentDotLook> = {
  running: { tone: 'success', pulse: true, badge: null },
  queued: { tone: 'info', pulse: false, badge: 'info' },
  stalled: { tone: 'neutral', pulse: false, badge: 'neutral' },
};

export const FACT_TONE_CLASS: Record<WorkflowFactTone, string> = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  warning: 'text-warning-fg',
  danger: 'text-danger-fg',
};

export const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
export const FOCUS_RING_INSET = 'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';

export const ROW_CLASS =
  'flex min-h-9 w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 text-left hover:bg-surface-hover sm:flex-nowrap';
export const LABEL_CLASS = 'order-1 min-w-0 flex-1 basis-[calc(100%-2.75rem)] truncate text-body text-fg sm:order-none sm:basis-0';
export const SECOND_LINE = 'order-3 sm:order-none';

export const NO_PHASES = 'No phases yet.';
export const NO_AGENTS = 'No agents yet.';
export const NOT_STARTED = 'Not started yet.';
export const DETAIL_ERROR_TITLE = 'Could not load this agent';
export const DETAIL_EMPTY = 'No detail available for this agent.';
export const DETAIL_SKELETON_ROWS = 3;

export function toolBarLabel(label: string, count: number, failed: string | null): string {
  return failed ? `${label}: ${count} calls, ${failed}` : `${label}: ${count} calls`;
}
