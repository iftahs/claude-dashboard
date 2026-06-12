import type { ReactNode } from 'react';

export interface SectionProps {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
  grow?: boolean;
  /** Optional hover explanation shown via a "?" badge next to the title. */
  help?: ReactNode;
}
