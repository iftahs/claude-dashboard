import type { ReactNode } from 'react';

export interface AppShellLayoutProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  sidebarCollapsed?: boolean;
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
  drawerLabel?: string;
}
