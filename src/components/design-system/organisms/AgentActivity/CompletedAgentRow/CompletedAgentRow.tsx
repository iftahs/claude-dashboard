import { motion, useReducedMotion } from 'framer-motion';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { ElapsedTime } from '@/components/design-system/atoms/ElapsedTime/ElapsedTime';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import {
  CHECK_HIDDEN,
  CHECK_POP,
  CHECK_SHOWN,
  COMPLETED_TITLE,
  MOTION_GONE,
  MOTION_GONE_NOW,
  MOTION_HIDDEN,
  MOTION_SHOWN,
} from '../utils';
import type { CompletedAgentRowProps } from './types';

export function CompletedAgentRow({ agent }: CompletedAgentRowProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.li
      layout="position"
      initial={MOTION_HIDDEN}
      animate={MOTION_SHOWN}
      exit={reducedMotion ? MOTION_GONE_NOW : MOTION_GONE}
      className="flex h-9 min-w-0 items-center gap-2"
    >
      <motion.span
        initial={reducedMotion ? false : CHECK_HIDDEN}
        animate={CHECK_SHOWN}
        transition={CHECK_POP}
        className="flex flex-none text-success-fg"
      >
        <Icon name="check" size={14} />
      </motion.span>
      <span title={agent.name} className="min-w-0 flex-1 truncate text-small font-medium text-fg sm:max-w-[40%] sm:flex-none">
        {agent.name}
      </span>
      <span title={agent.description} className="hidden min-w-0 flex-1 truncate text-small text-fg-muted sm:block">
        {agent.description}
      </span>
      <ModelChip model={agent.model} className="hidden sm:inline-flex" />
      {agent.tokens ? (
        <span className="hidden flex-none whitespace-nowrap font-mono text-mono text-fg-muted md:block">{agent.tokens}</span>
      ) : null}
      <Badge tone="success">Done</Badge>
      <span title={COMPLETED_TITLE} className="flex w-14 flex-none justify-end">
        <ElapsedTime since={agent.completedAt} format="ago" className="font-mono text-mono text-fg-subtle" />
      </span>
    </motion.li>
  );
}
