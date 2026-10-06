import type { ReactNode } from 'react';

export type SettingRowLayout = 'inline' | 'stacked';

export interface SettingRowProps {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  below?: ReactNode;
  layout?: SettingRowLayout;
  className?: string;
}
