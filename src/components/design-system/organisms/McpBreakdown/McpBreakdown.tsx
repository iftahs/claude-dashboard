import { Table } from '@/components/design-system/atoms/Table/Table';
import { TableCell } from '@/components/design-system/atoms/TableCell/TableCell';
import { TableRow } from '@/components/design-system/atoms/TableRow/TableRow';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { cn } from '@/lib/cn';
import type { McpBreakdownProps } from './types';
import { LEGEND_LABEL, TABLE_CAPTION, splitLabel, splitSegments } from './utils';

export function McpBreakdown({ view, className }: McpBreakdownProps) {
  const segments = splitSegments(view);

  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} ai={view.ai} className={className}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div role="img" aria-label={splitLabel(view)} className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
            {segments.map((segment) =>
              segment.percent > 0 ? (
                <div key={segment.key} className="h-full" style={{ width: `${segment.percent}%`, backgroundColor: segment.color }} />
              ) : null,
            )}
          </div>
          <Legend ariaLabel={LEGEND_LABEL} items={segments} />
        </div>

        <p className="text-small text-fg-muted">{view.explanation}</p>

        {view.servers.length > 0 ? (
          <div className="overflow-hidden rounded-control border border-line">
            <Table caption={TABLE_CAPTION}>
              <thead>
                <TableRow>
                  <TableCell header>MCP server</TableCell>
                  <TableCell header numeric>
                    Calls
                  </TableCell>
                  <TableCell header numeric>
                    Errors
                  </TableCell>
                </TableRow>
              </thead>
              <tbody>
                {view.servers.map((server) => (
                  <TableRow key={server.server}>
                    <TableCell truncate title={server.server} className="font-mono text-mono">
                      {server.server}
                    </TableCell>
                    <TableCell numeric className="text-fg">
                      {server.calls}
                    </TableCell>
                    <TableCell numeric className={cn(server.failed ? 'text-danger-fg' : 'text-fg-subtle')}>
                      {server.errors}
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}

        {view.emptyNote ? <p className="text-small text-fg-muted">{view.emptyNote}</p> : null}
      </div>
    </Section>
  );
}
