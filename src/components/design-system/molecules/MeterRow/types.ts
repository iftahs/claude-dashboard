import type { ReactNode } from 'react';
import type { ProgressBarTone } from '@/components/design-system/atoms/ProgressBar/types';

export type MeterRowSize = 'md' | 'sm';

export interface MeterRowProps {
  label: string;
  value: ReactNode;
  percent: number;
  tone?: ProgressBarTone;
  note?: ReactNode;
  size?: MeterRowSize;
  className?: string;
}
