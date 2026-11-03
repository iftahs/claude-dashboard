import { memo, useId, useState } from 'react';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { TagEditor } from '@/components/design-system/molecules/TagEditor/TagEditor';
import { cn } from '@/lib/cn';
import { ProjectSessionList } from '../ProjectSessionList/ProjectSessionList';
import { sessionsLabel, tagsLabel, toggleLabel } from '../utils';
import type { ProjectBreakdownRowProps } from './types';

export const ProjectBreakdownRow = memo(function ProjectBreakdownRow({
  row,
  noun,
  suggestions,
  onTagsChange,
  onOpenSession,
}: ProjectBreakdownRowProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const expandable = row.sessions.length > 0;

  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <span className="flex min-w-0 items-center gap-1">
          {expandable ? (
            <IconButton
              label={toggleLabel(noun, row.name)}
              size="sm"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              onClick={() => setOpen((current) => !current)}
              className="-ml-1.5"
            >
              <Icon name={open ? 'chevronDown' : 'chevronRight'} />
            </IconButton>
          ) : null}
          <span dir="auto" title={row.path} className="min-w-0 truncate text-body font-medium text-fg">
            {row.name}
          </span>
        </span>
        <span className={cn('flex-none whitespace-nowrap font-mono text-mono tabular-nums', row.missing ? 'text-fg-subtle' : 'text-fg-muted')}>
          {row.value}
        </span>
      </div>
      <ProgressBar value={row.percent} label={row.name} />
      <div className="flex min-w-0 justify-between gap-3 font-mono text-mono tabular-nums text-fg-subtle">
        <span title={row.count} className="min-w-0 truncate">
          {row.count}
        </span>
        <span className="flex-none whitespace-nowrap">{row.secondary}</span>
      </div>
      <TagEditor label={tagsLabel(row.name)} value={row.tags} suggestions={suggestions} onChange={(next) => onTagsChange(row.path, next)} />
      {open ? (
        <ProjectSessionList
          id={listId}
          label={sessionsLabel(noun, row.name)}
          sessions={row.sessions}
          more={row.more}
          partialNote={row.partialNote}
          onOpen={onOpenSession}
        />
      ) : null}
    </li>
  );
});
