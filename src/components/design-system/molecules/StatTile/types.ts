import type { ReactNode } from 'react';

export type StatTileTone = 'default' | 'success' | 'warning' | 'danger' | 'accent';

export type StatTileSize = 'md' | 'sm';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StatTileTone;
  help?: ReactNode;
  size?: StatTileSize;
  className?: string;
}
