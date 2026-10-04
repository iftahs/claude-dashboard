import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string;
  sub?: ReactNode;
  accent?: string;
  /** Optional hover explanation shown via a "?" badge next to the label. */
  help?: ReactNode;
}
