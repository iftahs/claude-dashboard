import type { TdHTMLAttributes } from 'react';

export type TableCellAlign = 'left' | 'right';

export interface TableCellProps extends Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'> {
  header?: boolean;
  align?: TableCellAlign;
  numeric?: boolean;
  truncate?: boolean;
}
