import type { ReactNode } from 'react';

export type KeyValueRowTone = 'default' | 'muted' | 'success' | 'warning' | 'danger' | 'accent';

export interface KeyValueRowProps {
  label: string;
  value: ReactNode;
  help?: ReactNode;
  tone?: KeyValueRowTone;
  className?: string;
}
