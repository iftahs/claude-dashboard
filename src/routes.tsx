import { lazy } from 'react';
import type { ReactNode } from 'react';
import { matchPath } from 'react-router-dom';
import { LegacyTabFrame } from '@/components/common/LegacyTabFrame/LegacyTabFrame';
import type { IconName } from '@/components/design-system/atoms/Icon/types';
import type { Platform } from '@/lib/platform';

export type RouteId =
  | 'overview'
  | 'live'
  | 'agents'
  | 'workflows'
  | 'trends'
  | 'models'
  | 'insights'
  | 'sessions'
  | 'workspace'
  | 'ai'
  | 'settings';

export type RouteGroupId = 'monitor' | 'analyze' | 'tools' | 'pinned';

export type RouteIcon = IconName;

export interface AppRoute {
  id: RouteId;
  path: string;
  label: string;
  group: RouteGroupId;
  icon: RouteIcon;
  element: ReactNode;
  hideFor?: readonly Platform[];
}

export interface RouteGroup {
  id: RouteGroupId;
  label: string;
}

// Pages are code-split: each is its own chunk, so recharts and the charts stay out of the first paint.
const OverviewPage = lazy(() => import('@/pages/OverviewPage/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const LivePage = lazy(() => import('@/pages/LivePage/LivePage').then((m) => ({ default: m.LivePage })));
const AgentsPage = lazy(() => import('@/pages/AgentsPage/AgentsPage').then((m) => ({ default: m.AgentsPage })));
const WorkflowsPage = lazy(() => import('@/pages/WorkflowsPage/WorkflowsPage').then((m) => ({ default: m.WorkflowsPage })));
const TrendsTab = lazy(() => import('@/components/legacy/tabs/TrendsTab/TrendsTab').then((m) => ({ default: m.TrendsTab })));
const ModelsTab = lazy(() => import('@/components/legacy/tabs/ModelsTab/ModelsTab').then((m) => ({ default: m.ModelsTab })));
const InsightsTab = lazy(() =>
  import('@/components/legacy/tabs/InsightsTab/InsightsTab').then((m) => ({ default: m.InsightsTab })),
);
const SessionsTab = lazy(() =>
  import('@/components/legacy/tabs/SessionsTab/SessionsTab').then((m) => ({ default: m.SessionsTab })),
);
const WorkspacePage = lazy(() => import('@/pages/WorkspacePage/WorkspacePage').then((m) => ({ default: m.WorkspacePage })));
const AiPage = lazy(() => import('@/pages/AiPage/AiPage').then((m) => ({ default: m.AiPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage/SettingsPage').then((m) => ({ default: m.SettingsPage })));

export const ROUTE_GROUPS: readonly RouteGroup[] = [
  { id: 'monitor', label: 'Monitor' },
  { id: 'analyze', label: 'Analyze' },
  { id: 'tools', label: 'Tools' },
];

export const ROUTES: readonly AppRoute[] = [
  { id: 'overview', path: '/overview', label: 'Overview', group: 'monitor', icon: 'layout', element: <OverviewPage /> },
  {
    id: 'live',
    path: '/live',
    label: 'Live usage',
    group: 'monitor',
    icon: 'activity',
    element: <LivePage />,
  },
  {
    id: 'agents',
    path: '/agents',
    label: 'Agents',
    group: 'monitor',
    icon: 'bot',
    element: <AgentsPage />,
  },
  {
    id: 'workflows',
    path: '/workflows',
    label: 'Workflows',
    group: 'monitor',
    icon: 'workflow',
    // Codex records no workflow runs, so the page has nothing to show there.
    hideFor: ['codex'],
    element: <WorkflowsPage />,
  },
  {
    id: 'trends',
    path: '/trends',
    label: 'Trends',
    group: 'analyze',
    icon: 'trending',
    element: (
      <LegacyTabFrame routeId="trends">
        <TrendsTab />
      </LegacyTabFrame>
    ),
  },
  {
    id: 'models',
    path: '/models',
    label: 'Models',
    group: 'analyze',
    icon: 'layers',
    element: (
      <LegacyTabFrame routeId="models">
        <ModelsTab />
      </LegacyTabFrame>
    ),
  },
  {
    id: 'insights',
    path: '/insights',
    label: 'Insights',
    group: 'analyze',
    icon: 'bars',
    element: (
      <LegacyTabFrame routeId="insights">
        <InsightsTab />
      </LegacyTabFrame>
    ),
  },
  {
    id: 'sessions',
    path: '/sessions',
    label: 'Sessions',
    group: 'analyze',
    icon: 'list',
    element: (
      <LegacyTabFrame routeId="sessions">
        <SessionsTab />
      </LegacyTabFrame>
    ),
  },
  {
    id: 'workspace',
    path: '/workspace',
    label: 'Workspace',
    group: 'tools',
    icon: 'folder',
    element: <WorkspacePage />,
  },
  {
    id: 'ai',
    path: '/ai',
    label: 'AI insights',
    group: 'tools',
    icon: 'sparkles',
    element: <AiPage />,
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    group: 'pinned',
    icon: 'sliders',
    element: <SettingsPage />,
  },
];

export const DEFAULT_ROUTE: AppRoute = ROUTES[0];

export function routesFor(platform: Platform): AppRoute[] {
  return ROUTES.filter((route) => !route.hideFor?.includes(platform));
}

// Agrees with the router's own matching (case-insensitive, trailing slash ignored); unknown and hidden paths are the default route.
export function resolveRoute(pathname: string, platform: Platform): AppRoute {
  return routesFor(platform).find((route) => matchPath({ path: route.path, end: true }, pathname)) ?? DEFAULT_ROUTE;
}
