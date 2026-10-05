import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BRAND } from '@/lib/platform';
import { ROUTE_GROUPS } from '@/routes';
import type { RouteIcon } from '@/routes';
import { useActiveRoute } from './useActiveRoute';
import { PALETTE_SHORTCUT, useCommandPalette } from './useCommandPalette';
import type { PaletteCommand } from './useCommandPalette';
import { useDashboardNotifications } from './useDashboardNotifications';
import { useDocumentTitle } from './useDocumentTitle';
import { useLiveData } from './useLiveData';
import { useMediaQuery } from './useMediaQuery';
import { useShellStatus } from './useShellStatus';
import { useSidebarCollapsed } from './useSidebarCollapsed';
import { useSidebarTabs } from './useSidebarTabs';
import type { SidebarTab } from './useSidebarTabs';
import { PLATFORM_LABELS, SOURCE_LABELS, useSource } from './useSource';
import { useTheme } from './useTheme';

const CREDIT = { name: 'Iftah Saar', href: 'https://iftah.dev' };
const PLATFORM_HELP =
  'Which platform the whole dashboard shows: Claude (Anthropic), Codex (OpenAI, via the ChatGPT desktop app), or both side by side';
const SURFACE_HELP = 'Filter Claude usage by surface: Claude Code CLI vs Cowork (desktop local-agent mode)';
// The `lg` breakpoint, where AppShellLayout swaps the sidebar column for the drawer.
const SIDEBAR_COLUMN_QUERY = '(min-width: 1024px)';

const toItem = (tab: SidebarTab) => ({ id: tab.id, href: tab.path, label: tab.label, icon: tab.icon, badge: tab.badge });

export function useAppShell() {
  const route = useActiveRoute();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { platform, setPlatform, platformOptions, source, setSource, sourceOptions, showSurfaceToggle, dataDirs } = useSource();
  const { recent, version } = useLiveData();
  const { theme, toggleTheme } = useTheme();
  const tabs = useSidebarTabs();
  const status = useShellStatus();
  const { collapsed, toggle: toggleCollapsed } = useSidebarCollapsed();
  const { open: paletteOpen, setOpen: setPaletteOpen, exportCommands } = useCommandPalette();
  const hasSidebarColumn = useMediaQuery(SIDEBAR_COLUMN_QUERY);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useDashboardNotifications(route.id);
  useDocumentTitle(route.label);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openPalette = useCallback(() => setPaletteOpen(true), [setPaletteOpen]);

  // Modified and non-primary clicks stay with the browser, so "open in new tab" keeps working on every link.
  const navigateTo = useCallback(
    (href: string, event?: MouseEvent<HTMLAnchorElement>) => {
      if (event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
      }
      navigate(href, { replace: href === pathname });
      setDrawerOpen(false);
    },
    [navigate, pathname],
  );

  const isFirstRoute = useRef(true);
  useEffect(() => {
    setDrawerOpen(false);
    if (isFirstRoute.current) {
      isFirstRoute.current = false;
      return;
    }
    // The shell's scrolling column outlives the page, so a new page would otherwise open at the old page's offset.
    document.getElementById('main-content')?.parentElement?.scrollTo({ top: 0 });
  }, [route.id]);

  const surfaceShown = showSurfaceToggle && route.id !== 'agents';

  const sidebarGroups = useMemo(
    () =>
      ROUTE_GROUPS.map((group) => ({
        id: group.id,
        label: group.label,
        items: tabs.filter((tab) => tab.group === group.id).map(toItem),
      })).filter((group) => group.items.length > 0),
    [tabs],
  );
  const pinned = useMemo(() => tabs.filter((tab) => tab.group === 'pinned').map(toItem), [tabs]);

  // Older backends omit the dirs from /api/sources; fall back to the envelope's claudeDir.
  const sidebarDirs = dataDirs.length ? dataDirs : recent.claudeDir ? [{ label: 'Claude', path: recent.claudeDir }] : [];

  const commandGroups = useMemo(() => {
    const go: PaletteCommand[] = tabs.map((tab) => ({
      id: `go-${tab.id}`,
      label: tab.label,
      icon: tab.icon,
      keywords: ['go', 'open', 'page'],
      current: tab.id === route.id,
      onSelect: () => navigateTo(tab.path),
    }));
    const actions: PaletteCommand[] = [];
    // The setters track a change, so picking the scope already on screen must not call them.
    for (const option of platformOptions) {
      actions.push({
        id: `platform-${option.value}`,
        label: `Switch platform to ${PLATFORM_LABELS[option.value]}`,
        icon: 'layers',
        current: option.value === platform,
        onSelect: () => {
          if (option.value !== platform) setPlatform(option.value);
        },
      });
    }
    if (surfaceShown) {
      for (const option of sourceOptions) {
        actions.push({
          id: `surface-${option.value}`,
          label: `Switch surface to ${SOURCE_LABELS[option.value]}`,
          icon: 'filter',
          keywords: ['source'],
          current: option.value === source,
          onSelect: () => {
            if (option.value !== source) setSource(option.value);
          },
        });
      }
    }
    actions.push({
      id: 'theme',
      label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      icon: theme === 'dark' ? 'sun' : 'moon',
      keywords: ['appearance', 'dark', 'light', 'mode'],
      onSelect: toggleTheme,
    });
    if (hasSidebarColumn) {
      actions.push({
        id: 'sidebar',
        label: collapsed ? 'Expand sidebar' : 'Collapse sidebar',
        icon: 'panel',
        keywords: ['navigation', 'rail'],
        onSelect: toggleCollapsed,
      });
    }
    actions.push(...exportCommands);
    return [
      { id: 'go', heading: 'Go to', items: go },
      { id: 'actions', heading: 'Actions', items: actions },
    ];
  }, [
    tabs, route.id, navigateTo, platformOptions, platform, setPlatform, surfaceShown, sourceOptions, source, setSource,
    theme, toggleTheme, hasSidebarColumn, collapsed, toggleCollapsed, exportCommands,
  ]);

  const toggleIcon: RouteIcon = drawerOpen ? 'x' : 'panel';

  return {
    routeId: route.id,
    layout: { sidebarCollapsed: collapsed, drawerOpen, onDrawerClose: closeDrawer },
    sidebar: {
      brand: BRAND,
      groups: sidebarGroups,
      pinned,
      activeId: route.id,
      // The drawer is always full width, whatever the column's collapsed state.
      collapsed: collapsed && !drawerOpen,
      toggleIcon,
      toggleLabel: drawerOpen ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar',
      onToggle: drawerOpen ? closeDrawer : toggleCollapsed,
      onNavigate: navigateTo,
      dataDirs: sidebarDirs,
      version: version.data,
      credit: CREDIT,
    },
    topbar: {
      title: route.label,
      drawerOpen,
      onOpenDrawer: openDrawer,
      platform:
        platformOptions.length > 0
          ? { label: 'Platform', help: PLATFORM_HELP, options: platformOptions, value: platform, onChange: setPlatform }
          : null,
      surface: surfaceShown
        ? { label: 'Surface', help: SURFACE_HELP, options: sourceOptions, value: source, onChange: setSource }
        : null,
      limit: status.limit ? { ...status.limit, href: '/live' } : null,
      agents: { ...status.agents, href: '/agents' },
      shortcut: PALETTE_SHORTCUT,
      onOpenPalette: openPalette,
      theme,
      onToggleTheme: toggleTheme,
      live: status.live,
      onNavigate: navigateTo,
    },
    palette: { open: paletteOpen, onOpenChange: setPaletteOpen, groups: commandGroups },
  };
}
