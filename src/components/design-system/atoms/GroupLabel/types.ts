import type { ReactNode } from 'react';

export type GroupLabelElement = 'h2' | 'h3' | 'span';

export interface GroupLabelProps {
  children: ReactNode;
  as?: GroupLabelElement;
  note?: ReactNode;
  id?: string;
  className?: string;
}
