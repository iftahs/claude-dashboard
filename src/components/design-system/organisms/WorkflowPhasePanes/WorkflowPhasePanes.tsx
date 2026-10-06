import { memo } from 'react';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { cn } from '@/lib/cn';
import type { WorkflowPhasePanesProps } from './types';
import { NO_AGENTS, NO_PHASES, NOT_STARTED } from './utils';
import { WorkflowAgentRow } from './WorkflowAgentRow/WorkflowAgentRow';
import { WorkflowPhaseItem } from './WorkflowPhaseItem/WorkflowPhaseItem';

export const WorkflowPhasePanes = memo(function WorkflowPhasePanes({
  view,
  onSelectPhase,
  onToggleAgent,
  onRetryAgent,
  className,
}: WorkflowPhasePanesProps) {
  const { runId, phases, note, selected } = view;

  return (
    <div className={cn('grid min-w-0 grid-cols-1 md:grid-cols-[184px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]', className)}>
      <div className="flex min-w-0 flex-col gap-0.5 border-b border-line p-3 md:border-b-0 md:border-r">
        <GroupLabel as="span" note={note} className="px-2 pb-1.5">
          Phases
        </GroupLabel>
        {phases.length === 0 ? (
          <p className="px-2 py-1 text-small text-fg-muted">{NO_PHASES}</p>
        ) : (
          <ul className="flex min-w-0 flex-col gap-0.5">
            {phases.map((phase) => (
              <WorkflowPhaseItem key={phase.key} phase={phase} onSelect={(index) => onSelectPhase(runId, index)} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex min-w-0 flex-col py-3">
        {selected ? (
          <>
            <p className="flex min-w-0 items-baseline gap-1.5 px-3 pb-2 text-small text-fg-muted">
              <span title={selected.title} className="min-w-0 truncate font-medium text-fg">
                {selected.title}
              </span>
              <span className="flex-none whitespace-nowrap">· {selected.summary}</span>
            </p>
            {selected.agents.length === 0 ? (
              <p className="px-3 py-2 text-small text-fg-muted">{NOT_STARTED}</p>
            ) : (
              <ul className="flex min-w-0 flex-col divide-y divide-line">
                {selected.agents.map((agent) => (
                  <WorkflowAgentRow
                    key={agent.key}
                    agent={agent}
                    onToggle={(agentId) => onToggleAgent(runId, agentId)}
                    onRetry={onRetryAgent ? (agentId) => onRetryAgent(runId, agentId) : undefined}
                  />
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="px-3 py-2 text-small text-fg-muted">{NO_AGENTS}</p>
        )}
      </div>
    </div>
  );
});
