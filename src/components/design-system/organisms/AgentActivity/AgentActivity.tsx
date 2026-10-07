import { memo, useEffect, useRef } from 'react';
import { AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { AgentActivityCounts } from './AgentActivityCounts/AgentActivityCounts';
import { MainAgentCard } from './MainAgentCard/MainAgentCard';
import { SubagentGroup } from './SubagentGroup/SubagentGroup';
import type { AgentActivityProps } from './types';
import { GROUP_CLASS, MOTION_ENTER, MOTION_OFF } from './utils';

export const AgentActivity = memo(function AgentActivity({ view, className }: AgentActivityProps) {
  const reducedMotion = useReducedMotion();
  // Rows that replace the empty state rise in; rows already there when the card loads do not.
  const wasEmpty = useRef(false);
  const enter = wasEmpty.current;

  useEffect(() => {
    wasEmpty.current = view.state?.kind === 'empty';
  }, [view.state]);

  return (
    <Section title={view.title} help={view.help} state={view.state} as="h3" className={className}>
      <MotionConfig reducedMotion="user" transition={reducedMotion ? MOTION_OFF : MOTION_ENTER}>
        <div className="flex min-w-0 flex-col gap-4">
          <AgentActivityCounts counts={view.counts} />
          <div className={GROUP_CLASS}>
            <GroupLabel as="span">{view.mainsLabel}</GroupLabel>
            <ul className="flex min-w-0 flex-col gap-3">
              <AnimatePresence initial={enter}>
                {view.mains.map((agent) => (
                  <MainAgentCard key={agent.key} agent={agent} subagentsLabel={view.subagentsLabel} />
                ))}
              </AnimatePresence>
            </ul>
          </div>
          <SubagentGroup
            label={view.orphansLabel}
            running={view.orphanRunning}
            completed={view.orphanCompleted}
            enter={enter}
            wide
          />
        </div>
      </MotionConfig>
    </Section>
  );
});
