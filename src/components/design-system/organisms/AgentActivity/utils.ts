import type { MainAgentState } from '@/lib/views/agents';
import type { AgentTrafficStatus } from '@/types';
import type { StateLook } from './types';

export const MAIN_STATE_LOOK: Record<MainAgentState, StateLook> = {
  waiting: { label: 'Waiting on you', dot: 'danger', badge: 'danger', pulse: false },
  delegating: { label: 'Delegating', dot: 'success', badge: 'success', pulse: true },
  running: { label: 'Running', dot: 'success', badge: 'success', pulse: true },
  yourTurn: { label: 'Your turn', dot: 'info', badge: 'info', pulse: false },
  idle: { label: 'Not active', dot: 'neutral', badge: 'neutral', pulse: false },
};

export const TRAFFIC_LOOK: Record<AgentTrafficStatus, StateLook> = {
  running: { label: 'Running', dot: 'success', badge: 'success', pulse: true },
  waiting: { label: 'Waiting on you', dot: 'danger', badge: 'danger', pulse: false },
  finished: { label: 'Finished', dot: 'success', badge: 'success', pulse: false },
};

export const MOTION_EASE = { duration: 0.15, ease: 'easeOut' } as const;
export const MOTION_OFF = { duration: 0 } as const;
export const MOTION_HIDDEN = { opacity: 0, y: 4 } as const;
export const MOTION_SHOWN = { opacity: 1, y: 0 } as const;
export const MOTION_GONE = { opacity: 0 } as const;

export const WELL_CLASS = 'relative isolate rounded-control border bg-surface-sunken';
export const FLASH_HOLD_MS = 300;

export const LAST_ACTIVITY_TITLE = 'Time since the last activity';
export const RUNNING_TIME_TITLE = 'Running time';
export const COMPLETED_TITLE = 'Time since it finished';
