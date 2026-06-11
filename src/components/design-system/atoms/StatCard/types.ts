import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string;
  sub?: ReactNode;
  accent?: string;
}
