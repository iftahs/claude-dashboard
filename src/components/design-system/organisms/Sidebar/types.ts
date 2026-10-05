import type { MouseEvent } from 'react';
import type { BadgeTone } from '@/components/design-system/atoms/Badge/types';
import type { IconName } from '@/components/design-system/atoms/Icon/types';

export interface SidebarBadge {
  text: string;
  tone?: BadgeTone;
  title?: string;
}

export interface SidebarItem {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  badge?: SidebarBadge;
}

export interface SidebarGroup {
  id: string;
  label: string;
  items: readonly SidebarItem[];
}

export interface SidebarDataDir {
  label: string;
  path: string;
}

export interface SidebarVersion {
  current?: string;
  latest?: string | null;
  updateAvailable?: boolean;
  changelogUrl?: string;
  repoUrl?: string;
}

export interface SidebarCredit {
  name: string;
  href: string;
}

export interface SidebarProps {
  brand: string;
  groups: readonly SidebarGroup[];
  pinned?: readonly SidebarItem[];
  activeId: string;
  collapsed?: boolean;
  toggleIcon: IconName;
  toggleLabel: string;
  onToggle: () => void;
  onNavigate?: (href: string, event: MouseEvent<HTMLAnchorElement>) => void;
  dataDirs?: readonly SidebarDataDir[];
  version?: SidebarVersion | null;
  credit?: SidebarCredit;
  navLabel?: string;
}
