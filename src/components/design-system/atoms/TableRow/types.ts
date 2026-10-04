import type { HTMLAttributes } from 'react';

export type TableRowState = 'default' | 'selected';

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  state?: TableRowState;
  interactive?: boolean;
}
