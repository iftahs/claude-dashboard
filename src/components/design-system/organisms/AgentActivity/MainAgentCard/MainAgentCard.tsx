import { motion } from 'framer-motion';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { ElapsedTime } from '@/components/design-system/atoms/ElapsedTime/ElapsedTime';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { useFlashOnIncrease } from '@/hooks/useFlashOnIncrease';
import { cn } from '@/lib/cn';
import { AgentFlash } from '../AgentFlash/AgentFlash';
import { AgentTokens } from '../AgentTokens/AgentTokens';
import { SubagentGroup } from '../SubagentGroup/SubagentGroup';
import { FLASH_HOLD_MS, LAST_ACTIVITY_TITLE, MAIN_STATE_LOOK, MOTION_GONE, MOTION_HIDDEN, MOTION_SHOWN, WELL_CLASS } from '../utils';
import type { MainAgentCardProps } from './types';

export function MainAgentCard({ agent, subagentsLabel }: MainAgentCardProps) {
  const flashTokens = useFlashOnIncrease(agent.effectiveTokens, FLASH_HOLD_MS);
  const flashActivity = useFlashOnIncrease(agent.lastActivity, FLASH_HOLD_MS);
  const flash = flashTokens || flashActivity;
  const look = MAIN_STATE_LOOK[agent.state];
  const idle = agent.state === 'idle';
  const hasSubagents = agent.running.length > 0 || agent.completed.length > 0;

  return (
    <motion.li
      layout="position"
      initial={MOTION_HIDDEN}
      animate={MOTION_SHOWN}
      exit={MOTION_GONE}
      className="flex min-w-0 flex-col gap-3"
    >
      <div
        className={cn(
          WELL_CLASS,
          'flex min-w-0 flex-col gap-2 px-4 py-3',
          agent.state === 'waiting' ? 'border-danger' : 'border-line',
        )}
      >
        <AgentFlash active={flash} />
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot tone={look.dot} pulse={look.pulse} />
          <span title={agent.title} className={cn('min-w-0 flex-1 truncate text-body font-medium', idle ? 'text-fg-muted' : 'text-fg')}>
            {agent.title}
          </span>
          <Badge tone={look.badge}>{look.label}</Badge>
          <span title={LAST_ACTIVITY_TITLE} className="flex flex-none items-baseline gap-1 whitespace-nowrap">
            <span className="hidden text-caption text-fg-subtle sm:inline">active</span>
            <ElapsedTime since={agent.lastActivity} format="ago" className="font-mono text-mono text-fg-muted" />
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-small text-fg-muted">
            <span title={agent.project}>{agent.project}</span>
            {agent.branch ? (
              <span title={agent.branch} className="font-mono text-mono text-fg-subtle">
                {' · '}
                {agent.branch}
              </span>
            ) : null}
          </p>
          <ModelChip model={agent.model} />
          <AgentTokens value={agent.effectiveTokens} />
        </div>
      </div>
      {hasSubagents ? (
        <div className="ml-2 min-w-0 border-l border-line pl-4">
          <SubagentGroup label={subagentsLabel} running={agent.running} completed={agent.completed} />
        </div>
      ) : null}
    </motion.li>
  );
}
