import { useId } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { ElapsedTime } from '@/components/design-system/atoms/ElapsedTime/ElapsedTime';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { cn } from '@/lib/cn';
import { AGENT_DOT_LOOK, FOCUS_RING_INSET, LABEL_CLASS, ROW_CLASS, SECOND_LINE } from '../utils';
import { WorkflowAgentDetail } from '../WorkflowAgentDetail/WorkflowAgentDetail';
import { WorkflowAgentMarker } from '../WorkflowAgentMarker/WorkflowAgentMarker';
import type { WorkflowAgentRowProps } from './types';

export function WorkflowAgentRow({ agent, onToggle, onRetry }: WorkflowAgentRowProps) {
  const detailId = useId();
  const stateBadge = agent.state === 'queued' || agent.state === 'stalled' ? AGENT_DOT_LOOK[agent.state].badge : null;

  return (
    <li className="flex min-w-0 flex-col">
      <button
        type="button"
        aria-expanded={agent.open}
        aria-controls={agent.open ? detailId : undefined}
        onClick={() => onToggle(agent.agentId)}
        className={cn(ROW_CLASS, FOCUS_RING_INSET)}
      >
        <WorkflowAgentMarker state={agent.state} label={agent.stateLabel} />
        <span title={agent.type ? `${agent.label} (${agent.type})` : agent.label} className={LABEL_CLASS}>
          {agent.label}
        </span>
        <span aria-hidden="true" className={cn('w-3.5 flex-none sm:hidden', SECOND_LINE)} />
        {agent.type ? (
          <span className="hidden max-w-[18%] flex-none truncate text-caption text-fg-muted xl:block">{agent.type}</span>
        ) : null}
        {stateBadge ? (
          <Badge tone={stateBadge} className={SECOND_LINE}>
            {agent.stateLabel}
          </Badge>
        ) : null}
        {agent.attempt ? (
          <Badge tone="warning" title="Attempt" className={SECOND_LINE}>
            {agent.attempt}
          </Badge>
        ) : null}
        <ModelChip model={agent.model} className={SECOND_LINE} />
        <span className={cn('ml-auto flex-none whitespace-nowrap font-mono text-mono tabular-nums text-fg-muted sm:ml-0', SECOND_LINE)}>
          {agent.metrics}
          {agent.runningSince !== null ? (
            <>
              {agent.metrics ? ' · ' : null}
              <ElapsedTime since={agent.runningSince} />
            </>
          ) : null}
        </span>
        <Icon name={agent.open ? 'chevronDown' : 'chevronRight'} size={14} className="order-2 flex-none text-fg-muted sm:order-none" />
      </button>
      {agent.open && agent.detail ? (
        <div id={detailId} className="min-w-0">
          <WorkflowAgentDetail detail={agent.detail} onRetry={onRetry ? () => onRetry(agent.agentId) : undefined} />
        </div>
      ) : null}
    </li>
  );
}
