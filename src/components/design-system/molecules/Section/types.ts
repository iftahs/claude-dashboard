import type { ReactNode } from 'react';

export interface SectionProps {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
  grow?: boolean;
}
