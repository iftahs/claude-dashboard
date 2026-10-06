import { ActivityBars } from '@/components/design-system/atoms/ActivityBars/ActivityBars';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { AGENT_DOT_LOOK } from '../utils';
import type { WorkflowAgentMarkerProps } from './types';

export function WorkflowAgentMarker({ state, label }: WorkflowAgentMarkerProps) {
  if (state === 'done' || state === 'error') {
    return (
      <span title={label} className="flex w-3.5 flex-none items-center justify-center">
        <Icon name={state === 'done' ? 'check' : 'x'} size={14} className={state === 'done' ? 'text-success-fg' : 'text-danger-fg'} />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  if (state === 'running') {
    return (
      <span title={label} className="flex w-3.5 flex-none items-center justify-center text-success">
        <ActivityBars />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  // Anything that is not running stays still, an unknown state included.
  const look = AGENT_DOT_LOOK[state] ?? AGENT_DOT_LOOK.stalled;
  return (
    <span title={label} className="flex w-3.5 flex-none items-center justify-center">
      <StatusDot tone={look.tone} label={label} />
    </span>
  );
}
