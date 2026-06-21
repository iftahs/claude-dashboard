import type { ReactNode } from 'react';

export interface SidebarTab {
  id: string;
  label: string;
  /** Emoji/icon glyph, rendered in a fixed-width slot so labels stay aligned. */
  icon?: string;
  /** Optional trailing chip (e.g. live agent count, 5-hour utilization %). */
  badge?: ReactNode;
}

export interface SidebarProps {
  tabs: SidebarTab[];
  activeTab: string;
  onNavigate: (id: string) => void;
  claudeDir: string | null;
  /** Footer credits: app version + repo link (optional). */
  version?: { current?: string; repoUrl?: string } | null;
}
