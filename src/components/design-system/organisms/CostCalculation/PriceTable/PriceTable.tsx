import { Button } from '@/components/design-system/atoms/Button/Button';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { Table } from '@/components/design-system/atoms/Table/Table';
import { TableCell } from '@/components/design-system/atoms/TableCell/TableCell';
import { TableRow } from '@/components/design-system/atoms/TableRow/TableRow';
import { PRICE_COLUMNS, PRICE_UNIT, isActivationKey } from '../utils';
import type { PriceTableProps } from './types';

export function PriceTable({ group, onSelectModel, onToggleGroup }: PriceTableProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <GroupLabel as="span" note={PRICE_UNIT}>
        {group.label}
      </GroupLabel>
      <div className="overflow-x-auto rounded-control border border-line">
        <Table caption={group.caption}>
          <thead>
            <TableRow>
              <TableCell header>Model</TableCell>
              {PRICE_COLUMNS.map((column) => (
                <TableCell key={column} header numeric>
                  {column}
                </TableCell>
              ))}
            </TableRow>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <TableRow
                key={row.key}
                interactive
                state={row.selected ? 'selected' : 'default'}
                tabIndex={0}
                aria-current={row.selected ? 'true' : undefined}
                onClick={() => onSelectModel(row.name)}
                onKeyDown={(event) => {
                  if (!isActivationKey(event.key)) return;
                  event.preventDefault();
                  onSelectModel(row.name);
                }}
              >
                <TableCell className="min-w-40 py-2">
                  {row.name}
                  {row.note ? <span className="block text-caption text-fg-subtle">{row.note}</span> : null}
                </TableCell>
                <TableCell numeric>{row.input}</TableCell>
                <TableCell numeric>{row.output}</TableCell>
                <TableCell numeric>{row.cacheWrite}</TableCell>
                <TableCell numeric>{row.cacheRead}</TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      </div>
      {group.toggleLabel ? (
        <Button variant="ghost" size="sm" className="self-start" aria-expanded={group.expanded} onClick={() => onToggleGroup(group.key)}>
          <Icon name={group.expanded ? 'chevronUp' : 'chevronDown'} size={14} />
          {group.toggleLabel}
        </Button>
      ) : null}
    </div>
  );
}
