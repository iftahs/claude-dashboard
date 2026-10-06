import { memo, useId } from 'react';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { ElapsedTime } from '@/components/design-system/atoms/ElapsedTime/ElapsedTime';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { WorkflowPhasePanes } from '@/components/design-system/organisms/WorkflowPhasePanes/WorkflowPhasePanes';
import { cn } from '@/lib/cn';
import type { WorkflowRunCardProps } from './types';

export const WorkflowRunCard = memo(function WorkflowRunCard({
  view,
  onSelectPhase,
  onToggleAgent,
  onRetryAgent,
  className,
}: WorkflowRunCardProps) {
  const titleId = useId();

  return (
    <Card padding="none" aria-labelledby={titleId} className={cn('overflow-hidden', className)}>
      <div className="flex min-w-0 items-center gap-3 border-b border-line px-5 py-4">
        {view.live ? <StatusDot tone="success" pulse label="Running" /> : <StatusDot tone="neutral" label="Not running" />}
        <h3 id={titleId} title={view.name} className="min-w-0 flex-1 truncate text-heading text-fg sm:max-w-[45%] sm:flex-none">
          {view.name}
        </h3>
        <p title={view.summary} className="hidden min-w-0 flex-1 truncate text-body text-fg-muted sm:block">
          {view.summary}
        </p>
        <span className="flex-none whitespace-nowrap font-mono text-mono tabular-nums text-fg-muted">
          {view.progress}
          {' · '}
          {view.live ? <ElapsedTime since={view.startedAt} /> : view.duration}
        </span>
      </div>
      <WorkflowPhasePanes view={view.panes} onSelectPhase={onSelectPhase} onToggleAgent={onToggleAgent} onRetryAgent={onRetryAgent} />
    </Card>
  );
});
