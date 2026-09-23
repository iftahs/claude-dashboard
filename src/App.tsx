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
import { useConfigMode } from './hooks/useConfigMode';
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
// Which tabs exist depends on the platform switcher (see tabsFor() below).
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
 * Tabs per platform. Every tab renders the selected platform's data, side by side
 * under Both, so the list is the same everywhere except that Codex alone drops
 * Workflows: Claude Code's workflow journals have no Codex counterpart (Codex
 * records no multi-agent runs). Under Both, Workflows stays and shows the Claude
 * runs with a scope note, and Workspace is on every platform.
 */
function tabsFor(platform: Platform) {
  return platform === 'codex' ? TABS.filter((t) => t.id !== 'workflows') : TABS;
}

/** What to say when the platform on screen has no local usage at all. */
function emptyCopy(platform: Platform): string {
  if (platform === 'codex') return 'No Codex usage found. Run a thread in the ChatGPT desktop app, then this dashboard will populate.';
  if (platform === 'both') return 'No usage logs found. Use Claude Code or Codex, then this dashboard will populate.';
  return 'No usage logs found. Use Claude Code, then this dashboard will populate.';
}

/** The Live tab's note when its live limits render over no local usage. */
function liveOnlyCopy(platform: Platform): string {
  const what = platform === 'codex' ? 'a Codex thread' : platform === 'both' ? 'Claude Code or Codex' : 'Claude Code';
  return `No local usage yet — the plan limits here are read live from your account. The charts fill in once you use ${what}.`;
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
  const {
    platform, setPlatform, platformOptions, source, setSource, sourceOptions, showSurfaceToggle,
    showClaude, showCodex, hasScopeData, sourcesError, dataDirs,
  } = useSource();

  // Memoised because useSidebarTabs keys its memo on the array identity; a fresh
  // array per render would rebuild every badge each poll.
  const visibleTabs = useMemo(() => tabsFor(platform), [platform]);
  const seg = location.pathname.replace(/^\//, '');
  const activeTab: Tab = visibleTabs.some((t) => t.id === seg) ? (seg as Tab) : 'live';

  const { recent, weekly, version, liveUsage, codexLive } = useLiveData();
  const { isApi } = useConfigMode();
  const limits = useLimits();
  const sidebarTabs = useSidebarTabs(visibleTabs);
  useDashboardNotifications(activeTab);
  useDocumentTitle();

  const error = recent.error || weekly.error;
  // Empty means the platform on screen has no local events AT ALL (lifetime counts
  // from /api/sources), not "nothing in the last 12 h / 7 d" — a user who simply
  // has not worked today must still see their history. The windows only confirm
  // it: they refresh every 5 s against the sources poll's 60 s, so first use shows
  // up at once.
  const windowsEmpty =
    !recent.loading &&
    !weekly.loading &&
    (recent.data?.totals.totalTokens ?? 0) === 0 &&
    (weekly.data?.totals.totalTokens ?? 0) === 0;
  const empty = hasScopeData === false && windowsEmpty;
  // Live limits come from the provider, not the local logs, so the Live tab still
  // has something true to show with no local usage.
  const hasLiveLimits =
    (showClaude && !isApi && !!liveUsage.data && !liveUsage.data.error) ||
    (showCodex && !!codexLive.data && !codexLive.data.error);
  const liveOnly = empty && activeTab === 'live' && hasLiveLimits;
  // Older backends omit the dirs from /api/sources; fall back to the envelope's claudeDir.
  const sidebarDirs = dataDirs.length
    ? dataDirs
    : recent.claudeDir ? [{ label: 'Claude', path: recent.claudeDir }] : [];

  return (
    <div className="flex h-screen">
      <Sidebar
        tabs={sidebarTabs}
        activeTab={activeTab}
        onNavigate={(id) => navigate(`/${id}`)}
        dataDirs={sidebarDirs}
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
            {/* The Agents feeds are not split by surface, so the toggle would do nothing there. */}
            {showSurfaceToggle && activeTab !== 'agents' && (
              <div className="flex items-center gap-2" title="Filter Claude usage by surface: Claude Code CLI vs Cowork (desktop local-agent mode)">
                <span className="text-[11px] uppercase tracking-wide text-zinc-600">source</span>
                <ToggleGroup<SourceFilter> options={sourceOptions} value={source} onChange={setSource} />
              </div>
            )}
            <LiveBadge error={error} />
          </header>

          <Suspense fallback={<TabFallback />}>
            {activeTab === 'settings' ? (
              <SettingsTab />
            ) : sourcesError ? (
              // The server never answered: say so, rather than claiming there is no usage.
              <div className="card mt-6 p-12 text-center">
                <p className="text-sm font-semibold text-red-300">Can't load usage data from the dashboard server</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {sourcesError.replace(/^Error:\s*/, '')} — it keeps retrying, and the dashboard loads as soon as
                  the server answers.
                </p>
              </div>
            ) : empty && !liveOnly ? (
              <div className="card mt-6 p-12 text-center text-zinc-400">{emptyCopy(platform)}</div>
            ) : (
              <div className="space-y-6">
                {liveOnly && (
                  <div className="card px-5 py-3 text-sm text-zinc-400">{liveOnlyCopy(platform)}</div>
                )}
                {activeTab === 'live' && <LiveTab limits={limits} />}
                {activeTab === 'agents' && <AgentsTab />}
                {activeTab === 'workflows' && platform === 'both' && (
                  <p className="text-xs text-zinc-500">
                    Claude Code only — Codex records no workflow runs, so this tab shows the Claude side.
                  </p>
                )}
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
