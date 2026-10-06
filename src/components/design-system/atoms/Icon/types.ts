import type { IconName } from '@/lib/icons';

export type { IconName };

export type IconSize = 12 | 14 | 16 | 20;

export interface IconProps {
  name: IconName;
  size?: IconSize;
  className?: string;
}
