import { ActivityBars } from '@/components/design-system/atoms/ActivityBars/ActivityBars';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { cn } from '@/lib/cn';
import { FOCUS_RING, PHASE_STATE_LABEL } from '../utils';
import type { WorkflowPhaseItemProps } from './types';

export function WorkflowPhaseItem({ phase, onSelect }: WorkflowPhaseItemProps) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-pressed={phase.selected}
        onClick={() => onSelect(phase.index)}
        className={cn(
          'flex h-8 w-full min-w-0 items-center gap-2 rounded-control px-2 text-left text-body',
          FOCUS_RING,
          phase.selected ? 'bg-surface-hover text-fg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
        )}
      >
        <span className="flex w-4 flex-none items-center justify-center">
          {phase.state === 'done' ? <Icon name="check" size={14} className="text-success-fg" /> : null}
          {phase.state === 'running' ? <ActivityBars className="text-success" /> : null}
          {phase.state === 'pending' || phase.state === 'partial' ? <span className="font-mono text-mono">{phase.index + 1}</span> : null}
        </span>
        <span title={phase.title} className="min-w-0 flex-1 truncate">
          {phase.title}
        </span>
        <span className="sr-only">{PHASE_STATE_LABEL[phase.state]}</span>
        {phase.count ? <span className="flex-none whitespace-nowrap font-mono text-mono tabular-nums text-fg-muted">{phase.count}</span> : null}
      </button>
    </li>
  );
}
