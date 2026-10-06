import type { MouseEvent } from 'react';
import type { SegmentedControlOption } from '@/components/design-system/atoms/SegmentedControl/types';
import type { LiveStatusState } from '@/components/design-system/molecules/LiveStatus/types';
import type { ThemeToggleTheme } from '@/components/design-system/molecules/ThemeToggle/types';

export interface TopbarScope<T extends string = string> {
  label: string;
  help?: string;
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export interface TopbarLimit {
  href: string;
  window: string;
  value: string;
  tone: 'neutral' | 'warning' | 'danger';
  title?: string;
}

export interface TopbarAgents {
  href: string;
  count: number;
  label: string;
  tone: 'neutral' | 'danger';
  running?: boolean;
  title?: string;
}

export interface TopbarLive {
  state: LiveStatusState;
  label?: string;
}

export interface TopbarProps<P extends string = string, S extends string = string> {
  title: string;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  platform?: TopbarScope<P> | null;
  surface?: TopbarScope<S> | null;
  limit?: TopbarLimit | null;
  agents?: TopbarAgents | null;
  shortcut: string;
  onOpenPalette: () => void;
  theme: ThemeToggleTheme;
  onToggleTheme: () => void;
  live: TopbarLive;
  onNavigate?: (href: string, event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface TopbarDensity {
  gap: string;
  divider: string;
  jumpLabel: string;
  shortcut: string;
  liveCaption?: string;
}
