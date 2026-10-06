import { motion } from 'framer-motion';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { ElapsedTime } from '@/components/design-system/atoms/ElapsedTime/ElapsedTime';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { useFlashOnIncrease } from '@/hooks/useFlashOnIncrease';
import { cn } from '@/lib/cn';
import { AgentFlash } from '../AgentFlash/AgentFlash';
import { AgentTokens } from '../AgentTokens/AgentTokens';
import { FLASH_HOLD_MS, MOTION_GONE, MOTION_HIDDEN, MOTION_SHOWN, RUNNING_TIME_TITLE, TRAFFIC_LOOK, WELL_CLASS } from '../utils';
import type { RunningAgentCardProps } from './types';

export function RunningAgentCard({ agent }: RunningAgentCardProps) {
  const flash = useFlashOnIncrease(agent.effectiveTokens, FLASH_HOLD_MS);
  const look = TRAFFIC_LOOK[agent.traffic];
  const waiting = agent.traffic === 'waiting';

  return (
    <motion.li
      layout="position"
      initial={MOTION_HIDDEN}
      animate={MOTION_SHOWN}
      exit={MOTION_GONE}
      className={cn(
        WELL_CLASS,
        'flex min-w-0 flex-col gap-2 px-3 py-2.5',
        waiting ? 'border-danger' : 'border-line',
      )}
    >
      <AgentFlash active={flash} />
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot tone={look.dot} pulse={look.pulse} />
        <span title={agent.name} className="min-w-0 flex-1 truncate text-body font-medium text-fg">
          {agent.name}
        </span>
        {waiting ? <Badge tone={look.badge}>{look.label}</Badge> : null}
        <span title={RUNNING_TIME_TITLE} className="flex flex-none items-baseline gap-1 whitespace-nowrap">
          {waiting ? null : <span className="text-caption text-fg-subtle">{look.label.toLowerCase()}</span>}
          <ElapsedTime since={agent.startedAt} className="font-mono text-mono text-fg-muted" />
        </span>
      </div>
      {agent.description ? (
        <p title={agent.description} className="line-clamp-2 text-small text-fg-muted">
          {agent.description}
        </p>
      ) : null}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <ModelChip model={agent.model} />
        <AgentTokens value={agent.effectiveTokens} />
      </div>
    </motion.li>
  );
}
