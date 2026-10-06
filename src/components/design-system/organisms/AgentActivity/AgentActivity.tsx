import { memo } from 'react';
import { AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { AgentActivityCounts } from './AgentActivityCounts/AgentActivityCounts';
import { MainAgentCard } from './MainAgentCard/MainAgentCard';
import { SubagentGroup } from './SubagentGroup/SubagentGroup';
import type { AgentActivityProps } from './types';
import { MOTION_EASE, MOTION_OFF } from './utils';

export const AgentActivity = memo(function AgentActivity({ view, className }: AgentActivityProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Section title={view.title} help={view.help} state={view.state} as="h3" className={className}>
      <MotionConfig reducedMotion="user" transition={reducedMotion ? MOTION_OFF : MOTION_EASE}>
        <div className="flex min-w-0 flex-col gap-4">
          <AgentActivityCounts counts={view.counts} />
          {view.mains.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-2">
              <GroupLabel as="span">{view.mainsLabel}</GroupLabel>
              <ul className="flex min-w-0 flex-col gap-3">
                <AnimatePresence initial={false}>
                  {view.mains.map((agent) => (
                    <MainAgentCard key={agent.key} agent={agent} subagentsLabel={view.subagentsLabel} />
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ) : null}
          <SubagentGroup label={view.orphansLabel} running={view.orphanRunning} completed={view.orphanCompleted} wide />
        </div>
      </MotionConfig>
    </Section>
  );
});
