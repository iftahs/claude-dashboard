import { memo } from 'react';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { TagEditor } from '@/components/design-system/molecules/TagEditor/TagEditor';
import { cn } from '@/lib/cn';
import { tagsLabel } from '../utils';
import type { ProjectBreakdownRowProps } from './types';

export const ProjectBreakdownRow = memo(function ProjectBreakdownRow({ row, suggestions, onTagsChange }: ProjectBreakdownRowProps) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-baseline justify-between gap-4">
        <span dir="auto" title={row.path} className="min-w-0 truncate text-body font-medium text-fg">
          {row.name}
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
    </li>
  );
});
