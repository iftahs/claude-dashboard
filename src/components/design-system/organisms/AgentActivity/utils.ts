import type { MainAgentState } from '@/lib/views/agents';
import type { AgentTrafficStatus } from '@/types';
import type { StateLook } from './types';

export const MAIN_STATE_LOOK: Record<MainAgentState, StateLook> = {
  waiting: { label: 'Waiting on you', dot: 'danger', badge: 'danger', live: false },
  delegating: { label: 'Delegating', dot: 'success', badge: 'success', live: true },
  running: { label: 'Running', dot: 'success', badge: 'success', live: true },
  yourTurn: { label: 'Your turn', dot: 'info', badge: 'info', live: false },
  idle: { label: 'Not active', dot: 'neutral', badge: 'neutral', live: false },
};

export const TRAFFIC_LOOK: Record<AgentTrafficStatus, StateLook> = {
  running: { label: 'Running', dot: 'success', badge: 'success', live: true },
  waiting: { label: 'Waiting on you', dot: 'danger', badge: 'danger', live: false },
  finished: { label: 'Finished', dot: 'success', badge: 'success', live: false },
};

export const MOTION_ENTER = { duration: 0.22, ease: [0.22, 1, 0.36, 1] } as const;
export const MOTION_OFF = { duration: 0 } as const;
export const MOTION_HIDDEN = { opacity: 0, y: 8 } as const;
export const MOTION_SHOWN = { opacity: 1, y: 0 } as const;
export const MOTION_GONE = { opacity: 0, transition: { duration: 0.14, ease: [0.2, 0, 0, 1] } } as const;
export const MOTION_GONE_NOW = { opacity: 0 } as const;
export const CHECK_HIDDEN = { opacity: 0, scale: 0.5 } as const;
export const CHECK_SHOWN = { opacity: 1, scale: 1 } as const;
export const CHECK_POP = { duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: 0.1 } as const;

export const WELL_CLASS = 'relative isolate rounded-control border bg-surface-sunken';
// Absolute, so the well keeps its size when the sweep comes and goes; inset to clear the rounded corners.
export const WELL_SWEEP_CLASS = 'absolute inset-x-1.5 bottom-0 w-auto bg-transparent';
// Always mounted so the first and the last row of a group still animate; a group with no rows hides itself.
export const GROUP_CLASS = 'flex min-w-0 flex-col gap-2 [&:not(:has(li))]:hidden';
export const FLASH_HOLD_MS = 300;

export const LAST_ACTIVITY_TITLE = 'Time since the last activity';
export const RUNNING_TIME_TITLE = 'Running time';
export const COMPLETED_TITLE = 'Time since it finished';
