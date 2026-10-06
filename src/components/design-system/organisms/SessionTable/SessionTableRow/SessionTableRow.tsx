import { memo } from 'react';
import type { KeyboardEvent } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { TableCell } from '@/components/design-system/atoms/TableCell/TableCell';
import { TableRow } from '@/components/design-system/atoms/TableRow/TableRow';
import { cn } from '@/lib/cn';
import { HEADLINE_CLASS } from '../utils';
import type { SessionTableRowProps } from './types';

export const SessionTableRow = memo(function SessionTableRow({ row, selected, onOpen }: SessionTableRowProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpen(row.id);
  };

  return (
    <TableRow
      interactive
      tabIndex={0}
      state={selected ? 'selected' : 'default'}
      onClick={() => onOpen(row.id)}
      onKeyDown={onKeyDown}
    >
      <TableCell numeric align="left">
        {row.started}
      </TableCell>
      <TableCell>
        <span className="flex min-w-0 items-center gap-1.5">
          <span dir="auto" title={row.project} className="max-w-48 truncate font-medium">
            {row.project}
          </span>
          {row.badge ? <Badge tone="info">{row.badge}</Badge> : null}
        </span>
      </TableCell>
      <TableCell truncate dir="auto" title={row.headlineTitle || undefined} className={cn('min-w-48', selected ? undefined : HEADLINE_CLASS[row.headlineKind])}>
        {row.headline}
      </TableCell>
      <TableCell numeric title={row.durationTitle} className={cn(!row.durationActive && 'text-fg-subtle')}>
        {row.duration}
      </TableCell>
      <TableCell numeric>{row.tokens}</TableCell>
    </TableRow>
  );
});
