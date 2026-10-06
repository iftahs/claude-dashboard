import type { ReactNode } from 'react';

export type SpecimenLayout = 'row' | 'stack';

export interface SpecimenProps {
  name: string;
  children: ReactNode;
  note?: string;
  layout?: SpecimenLayout;
}
