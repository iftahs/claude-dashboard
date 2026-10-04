import type { ReactElement } from 'react';
import type { IconName } from '@/components/design-system/atoms/Icon/types';

export type DropdownMenuAlign = 'start' | 'center' | 'end';

export type DropdownMenuItemTone = 'default' | 'danger';

export interface DropdownMenuItem {
  key: string;
  label: string;
  icon?: IconName;
  onSelect: () => void;
  tone?: DropdownMenuItemTone;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  trigger: ReactElement;
  items: readonly DropdownMenuItem[];
  align?: DropdownMenuAlign;
}
