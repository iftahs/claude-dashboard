import type { ReactNode } from 'react';

export interface ReservedBlockProps {
  id: string;
  settled: boolean;
  children: ReactNode;
}
