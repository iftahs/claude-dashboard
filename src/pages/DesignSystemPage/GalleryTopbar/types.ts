import type { Theme } from '@/hooks/useTheme';

export interface GalleryTopbarProps {
  title: string;
  theme: Theme;
  drawerOpen: boolean;
  onToggleTheme: () => void;
  onOpenDrawer: () => void;
}
