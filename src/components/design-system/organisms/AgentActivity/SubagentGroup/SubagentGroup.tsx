import { AnimatePresence } from 'framer-motion';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { cn } from '@/lib/cn';
import { CompletedAgentRow } from '../CompletedAgentRow/CompletedAgentRow';
import { RunningAgentCard } from '../RunningAgentCard/RunningAgentCard';
import { GROUP_CLASS } from '../utils';
import type { SubagentGroupProps } from './types';

export function SubagentGroup({ label, running, completed, wide = false, enter = false, className }: SubagentGroupProps) {
  return (
    <div className={cn(GROUP_CLASS, className)}>
      <GroupLabel as="span">{label}</GroupLabel>
      <ul className={cn('grid min-w-0 grid-cols-1 gap-2 *:min-w-0 empty:hidden md:grid-cols-2', wide && 'xl:grid-cols-3')}>
        <AnimatePresence initial={enter}>
          {running.map((agent) => (
            <RunningAgentCard key={agent.key} agent={agent} />
          ))}
        </AnimatePresence>
      </ul>
      <ul className="flex min-w-0 flex-col divide-y divide-line empty:hidden">
        <AnimatePresence initial={enter}>
          {completed.map((agent) => (
            <CompletedAgentRow key={agent.key} agent={agent} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
