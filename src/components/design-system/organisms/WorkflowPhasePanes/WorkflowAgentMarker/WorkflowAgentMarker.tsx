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

  const look = AGENT_DOT_LOOK[state] ?? AGENT_DOT_LOOK.running;
  return (
    <span title={label} className="flex w-3.5 flex-none items-center justify-center">
      <StatusDot tone={look.tone} pulse={look.pulse} label={label} />
    </span>
  );
}
