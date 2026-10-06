import { AnimatePresence } from 'framer-motion';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { cn } from '@/lib/cn';
import { CompletedAgentRow } from '../CompletedAgentRow/CompletedAgentRow';
import { RunningAgentCard } from '../RunningAgentCard/RunningAgentCard';
import type { SubagentGroupProps } from './types';

export function SubagentGroup({ label, running, completed, wide = false }: SubagentGroupProps) {
  if (running.length === 0 && completed.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <GroupLabel as="span">{label}</GroupLabel>
      {running.length > 0 ? (
        <ul className={cn('grid min-w-0 grid-cols-1 gap-2 *:min-w-0 md:grid-cols-2', wide && 'xl:grid-cols-3')}>
          <AnimatePresence initial={false}>
            {running.map((agent) => (
              <RunningAgentCard key={agent.key} agent={agent} />
            ))}
          </AnimatePresence>
        </ul>
      ) : null}
      {completed.length > 0 ? (
        <ul className="flex min-w-0 flex-col divide-y divide-line">
          <AnimatePresence initial={false}>
            {completed.map((agent) => (
              <CompletedAgentRow key={agent.key} agent={agent} />
            ))}
          </AnimatePresence>
        </ul>
      ) : null}
    </div>
  );
}
