import { memo } from 'react';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { Table } from '@/components/design-system/atoms/Table/Table';
import { TableCell } from '@/components/design-system/atoms/TableCell/TableCell';
import { TableRow } from '@/components/design-system/atoms/TableRow/TableRow';
import { EmptyState } from '@/components/design-system/molecules/EmptyState/EmptyState';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { SessionTableRow } from './SessionTableRow/SessionTableRow';
import type { SessionTableProps } from './types';
import { DURATION_HEADER, NEXT_LABEL, PAGER_LABEL, PREVIOUS_LABEL, PROJECT_HEADER, START_HEADER, TOKENS_HEADER } from './utils';

export const SessionTable = memo(function SessionTable({ view, onOpen, onPageChange, className }: SessionTableProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} padding="none" state={view.state} className={className}>
      {view.noMatches ? (
        <EmptyState
          icon="search"
          title={view.noMatches.title}
          description={view.noMatches.description}
          className="border-t border-line px-4 py-8"
        />
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <Table caption={view.caption} className="min-w-[640px]">
            <thead>
              <TableRow>
                <TableCell header>{START_HEADER}</TableCell>
                <TableCell header>{PROJECT_HEADER}</TableCell>
                <TableCell header>{view.subject}</TableCell>
                <TableCell header numeric>
                  {DURATION_HEADER}
                </TableCell>
                <TableCell header numeric>
                  {TOKENS_HEADER}
                </TableCell>
              </TableRow>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <SessionTableRow key={row.id} row={row} selected={row.id === view.selectedId} onOpen={onOpen} />
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {view.noMatches ? null : (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-3">
          <p role="status" className="min-w-0 text-caption text-fg-muted">
            {view.range}
          </p>
          {view.pageCount > 1 ? (
            <nav aria-label={PAGER_LABEL} className="flex flex-none items-center gap-2">
              <Button size="sm" disabled={view.page <= 1} onClick={() => onPageChange(view.page - 1)}>
                <Icon name="chevronLeft" />
                {PREVIOUS_LABEL}
              </Button>
              <span className="whitespace-nowrap px-1 font-mono text-mono tabular-nums text-fg-muted">{view.pageLabel}</span>
              <Button size="sm" disabled={view.page >= view.pageCount} onClick={() => onPageChange(view.page + 1)}>
                {NEXT_LABEL}
                <Icon name="chevronRight" />
              </Button>
            </nav>
          ) : null}
        </div>
      )}
    </Section>
  );
});
