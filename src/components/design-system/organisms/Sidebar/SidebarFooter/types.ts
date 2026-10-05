import type { SidebarCredit, SidebarDataDir, SidebarVersion } from '../types';

export interface SidebarFooterProps {
  dataDirs: readonly SidebarDataDir[];
  version?: SidebarVersion | null;
  credit?: SidebarCredit;
}
