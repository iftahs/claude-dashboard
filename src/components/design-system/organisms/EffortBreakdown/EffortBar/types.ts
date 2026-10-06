import type { HTMLAttributes } from 'react';
import type { EffortSliceView } from '@/lib/views/models';

export type EffortBarSize = 'sm' | 'md';

export interface EffortBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  slices: readonly EffortSliceView[];
  name: string;
  size?: EffortBarSize;
}
