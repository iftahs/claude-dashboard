import { memo, useId } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { WorkflowPhasePanes } from '@/components/design-system/organisms/WorkflowPhasePanes/WorkflowPhasePanes';
import { cn } from '@/lib/cn';
import type { WorkflowRunRowProps } from './types';
import { COST_FOCUS, HIDE_DETAILS, SHOW_DETAILS } from './utils';

export const WorkflowRunRow = memo(function WorkflowRunRow({
  view,
  onToggle,
  onSelectPhase,
  onToggleAgent,
  onRetryAgent,
  className,
}: WorkflowRunRowProps) {
  const titleId = useId();
  const detailsId = useId();

  return (
    <Card as="article" padding="none" aria-labelledby={titleId} className={cn('overflow-hidden', className)}>
      <div className="flex min-w-0 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex w-4 flex-none items-center justify-center">
            {view.status === 'completed' ? <Icon name="check" className="text-success-fg" /> : null}
            {view.status === 'failed' ? <Icon name="x" className="text-danger-fg" /> : null}
            {view.status === 'running' ? <StatusDot tone="success" pulse /> : null}
            {view.status === 'unknown' ? <StatusDot tone="neutral" /> : null}
          </span>
          <h3 id={titleId} title={view.name} className="min-w-0 flex-1 truncate text-heading text-fg md:max-w-[45%] md:flex-none">
            {view.name}
          </h3>
          <p title={view.summary} className="hidden min-w-0 flex-1 truncate text-body text-fg-muted md:block">
            {view.summary}
          </p>
          {view.model ? <ModelChip model={view.model} className="hidden sm:inline-flex" /> : null}
          <Badge tone={view.statusTone}>{view.statusLabel}</Badge>
          <span className="flex-none whitespace-nowrap font-mono text-mono tabular-nums text-fg-subtle">{view.when}</span>
        </div>

        <div className="flex min-w-0 items-center gap-4 pl-7">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
            {view.meta.map((item, index) => (
              <span key={`${index}:${item}`} title={item} className="max-w-full truncate font-mono text-mono tabular-nums text-fg-muted">
                {item}
              </span>
            ))}
            {view.cost ? (
              <Tooltip content={view.costHelp}>
                <span tabIndex={0} className={cn('whitespace-nowrap font-mono text-mono tabular-nums text-warning-fg', COST_FOCUS)}>
                  {view.cost}
                </span>
              </Tooltip>
            ) : null}
          </div>
          {view.expandable ? (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={view.open}
              aria-controls={view.open ? detailsId : undefined}
              onClick={() => onToggle(view.runId)}
            >
              <Icon name={view.open ? 'chevronDown' : 'chevronRight'} />
              {view.open ? HIDE_DETAILS : SHOW_DETAILS}
            </Button>
          ) : null}
        </div>

        {view.resultStats.length > 0 ? (
          <dl className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 pl-7">
            {view.resultStats.map((stat) => (
              <div key={stat.key} className="flex min-w-0 items-baseline gap-1.5 text-caption text-fg-subtle">
                <dt className="whitespace-nowrap">{stat.label}</dt>
                <dd title={stat.value} className="min-w-0 max-w-64 truncate font-mono tabular-nums text-fg">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {view.open ? (
        <div id={detailsId} className="min-w-0 border-t border-line">
          {view.panes ? (
            <WorkflowPhasePanes
              view={view.panes}
              onSelectPhase={onSelectPhase}
              onToggleAgent={onToggleAgent}
              onRetryAgent={onRetryAgent}
            />
          ) : null}
          {view.log.length > 0 ? (
            <div className={cn('flex min-w-0 flex-col gap-1.5 p-4', view.panes && 'border-t border-line')}>
              <GroupLabel as="span">Log</GroupLabel>
              <ul className="min-w-0 rounded-control border border-line bg-surface-sunken px-3 py-2 font-mono text-mono text-fg-muted">
                {view.log.map((line, index) => (
                  <li key={index} title={line} className="truncate">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
});
