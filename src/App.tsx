import { lazy, Suspense, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LiveBadge } from './components/design-system/atoms/LiveBadge/LiveBadge';
import { ToggleGroup } from './components/design-system/atoms/ToggleGroup/ToggleGroup';
import { Skeleton } from './components/design-system/atoms/Skeleton/Skeleton';
import { Sidebar } from './components/design-system/organisms/Sidebar/Sidebar';
import { AgentTrafficSignal } from './components/design-system/organisms/AgentTrafficSignal/AgentTrafficSignal';

// Tabs are code-split: only one is ever mounted, but statically importing all
// of them pulled every chart and the whole of recharts into the first chunk
// (1.19 MB) before anything could paint. Each is now its own lazily-fetched chunk.
// They use named exports, so the module is remapped to the default lazy() expects.
const LiveTab = lazy(() => import('./components/tabs/LiveTab/LiveTab').then((m) => ({ default: m.LiveTab })));
const AgentsTab = lazy(() => import('./components/tabs/AgentsTab/AgentsTab').then((m) => ({ default: m.AgentsTab })));
const WorkflowsTab = lazy(() => import('./components/tabs/WorkflowsTab/WorkflowsTab').then((m) => ({ default: m.WorkflowsTab })));
const TrendsTab = lazy(() => import('./components/tabs/TrendsTab/TrendsTab').then((m) => ({ default: m.TrendsTab })));
const ModelsTab = lazy(() => import('./components/tabs/ModelsTab/ModelsTab').then((m) => ({ default: m.ModelsTab })));
const InsightsTab = lazy(() => import('./components/tabs/InsightsTab/InsightsTab').then((m) => ({ default: m.InsightsTab })));
const WorkspaceTab = lazy(() => import('./components/tabs/WorkspaceTab/WorkspaceTab').then((m) => ({ default: m.WorkspaceTab })));
const AiTab = lazy(() => import('./components/tabs/AiTab/AiTab').then((m) => ({ default: m.AiTab })));
const SessionsTab = lazy(() => import('./components/tabs/SessionsTab/SessionsTab').then((m) => ({ default: m.SessionsTab })));
const SettingsTab = lazy(() => import('./components/tabs/SettingsTab/SettingsTab').then((m) => ({ default: m.SettingsTab })));

import { useSource, type Platform, type SourceFilter } from './hooks/useSource';
import { useLiveData } from './hooks/useLiveData';
import { useLimits } from './hooks/useLimits';
import { useSidebarTabs } from './hooks/useSidebarTabs';
import { useDashboardNotifications } from './hooks/useDashboardNotifications';
import { useDocumentTitle } from './hooks/useDocumentTitle';

type Tab =
  | 'live'
  | 'agents'
  | 'workflows'
  | 'trends'
  | 'models'
  | 'insights'
  | 'workspace'
  | 'ai'
  | 'sessions'
  | 'settings';

// `settings` must stay last — it's pinned to the bottom of the sidebar nav.
// Icons are a separate field so the sidebar can align them in a fixed-width slot
// (emoji glyphs render at different widths, which otherwise misaligns the labels).
// Which tabs exist depends on the platform switcher (see PLATFORM_TABS below).
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'live', icon: '⚡', label: 'Live Usage' },
  { id: 'agents', icon: '🤖', label: 'Agents · Live Activity' },
  { id: 'workflows', icon: '🔀', label: 'Workflows' },
  { id: 'trends', icon: '📈', label: 'Trends' },
  { id: 'models', icon: '🧠', label: 'Models' },
  { id: 'insights', icon: '🔍', label: 'Insights' },
  { id: 'workspace', icon: '🗂', label: 'Workspace' },
  { id: 'ai', icon: '🪄', label: 'AI Insights' },
  { id: 'sessions', icon: '📋', label: 'Sessions' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
];

/**
 * Tabs per platform. Claude keeps the full original list. Codex (and Both) drop
 * the Claude-only surfaces — Workflows (Claude Code's workflow journals) and
 * Workspace (~/.claude tasks/plans) have no Codex counterpart — and every
 * remaining tab renders the selected platform's data, side by side under Both.
 */
const CODEX_TABS = new Set<Tab>(['live', 'agents', 'trends', 'models', 'insights', 'ai', 'sessions', 'settings']);
function tabsFor(platform: Platform) {
  return platform === 'claude' ? TABS : TABS.filter((t) => CODEX_TABS.has(t.id));
}

/** Shown for the one frame it takes a tab chunk to arrive. Shaped like a tab body
 *  so switching tabs does not collapse the layout. */
function TabFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { platform, setPlatform, platformOptions, source, setSource, sourceOptions, showSurfaceToggle } = useSource();

  // Memoised because useSidebarTabs keys its memo on the array identity; a fresh
  // array per render would rebuild every badge each poll.
  const visibleTabs = useMemo(() => tabsFor(platform), [platform]);
  const seg = location.pathname.replace(/^\//, '');
  const activeTab: Tab = visibleTabs.some((t) => t.id === seg) ? (seg as Tab) : 'live';

  const { recent, weekly, version } = useLiveData();
  const [limits, setLimits] = useLimits();
  const sidebarTabs = useSidebarTabs(visibleTabs);
  useDashboardNotifications(activeTab, limits);
  useDocumentTitle();

  const error = recent.error || weekly.error;
  const empty =
    !recent.loading &&
    !weekly.loading &&
    (recent.data?.totals.totalTokens ?? 0) === 0 &&
    (weekly.data?.totals.totalTokens ?? 0) === 0;

  return (
    <div className="flex h-screen">
      <Sidebar
        tabs={sidebarTabs}
        activeTab={activeTab}
        onNavigate={(id) => navigate(`/${id}`)}
        claudeDir={recent.claudeDir ?? null}
        version={version.data}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <header className="mb-6 flex items-center justify-end gap-4">
            <AgentTrafficSignal />
            {platformOptions.length > 0 && (
              <div className="flex items-center gap-2" title="Which platform the whole dashboard shows: Claude (Anthropic), Codex (OpenAI, via the ChatGPT desktop app), or both side by side">
                <span className="text-[11px] uppercase tracking-wide text-zinc-600">platform</span>
                <ToggleGroup<Platform> options={platformOptions} value={platform} onChange={setPlatform} />
              </div>
            )}
            {showSurfaceToggle && (
              <div className="flex items-center gap-2" title="Filter Claude usage by surface: Claude Code CLI vs Cowork (desktop local-agent mode)">
                <span className="text-[11px] uppercase tracking-wide text-zinc-600">source</span>
                <ToggleGroup<SourceFilter> options={sourceOptions} value={source} onChange={setSource} />
              </div>
            )}
            <LiveBadge error={error} />
          </header>

          <Suspense fallback={<TabFallback />}>
            {activeTab === 'settings' ? (
              <SettingsTab limits={limits} onChangeLimits={setLimits} />
            ) : empty ? (
              <div className="card mt-6 p-12 text-center text-zinc-400">
                {platform === 'codex'
                  ? 'No Codex usage found. Run a thread in the ChatGPT desktop app, then this dashboard will populate.'
                  : 'No usage logs found. Use Claude Code, then this dashboard will populate.'}
              </div>
            ) : (
              <div className="space-y-6">
                {activeTab === 'live' && <LiveTab limits={limits} />}
                {activeTab === 'agents' && <AgentsTab />}
                {activeTab === 'workflows' && <WorkflowsTab />}
                {activeTab === 'trends' && <TrendsTab />}
                {activeTab === 'models' && <ModelsTab />}
                {activeTab === 'insights' && <InsightsTab />}
                {activeTab === 'workspace' && <WorkspaceTab />}
                {activeTab === 'ai' && <AiTab />}
                {activeTab === 'sessions' && <SessionsTab />}
              </div>
            )}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
