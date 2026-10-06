import type { HTMLAttributes } from 'react';

export interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  color?: string;
}
