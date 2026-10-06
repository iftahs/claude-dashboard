import type { IconName } from '@/components/design-system/atoms/Icon/types';

export interface CommandPaletteItem {
  id: string;
  label: string;
  icon?: IconName;
  keywords?: readonly string[];
  hint?: string;
  current?: boolean;
  onSelect: () => void;
}

export interface CommandPaletteGroup {
  id: string;
  heading: string;
  items: readonly CommandPaletteItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly CommandPaletteGroup[];
  title?: string;
  placeholder?: string;
  emptyLabel?: string;
}
