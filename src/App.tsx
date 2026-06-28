import { useLocation, useNavigate } from 'react-router-dom';
import { LiveBadge } from './components/design-system/atoms/LiveBadge/LiveBadge';
import { ToggleGroup } from './components/design-system/atoms/ToggleGroup/ToggleGroup';
import { Sidebar } from './components/design-system/organisms/Sidebar/Sidebar';
import { AgentTrafficSignal } from './components/design-system/organisms/AgentTrafficSignal/AgentTrafficSignal';
import { LiveTab } from './components/tabs/LiveTab/LiveTab';
import { AgentsTab } from './components/tabs/AgentsTab/AgentsTab';
import { WorkflowsTab } from './components/tabs/WorkflowsTab/WorkflowsTab';
import { TrendsTab } from './components/tabs/TrendsTab/TrendsTab';
import { ModelsTab } from './components/tabs/ModelsTab/ModelsTab';
import { InsightsTab } from './components/tabs/InsightsTab/InsightsTab';
import { WorkspaceTab } from './components/tabs/WorkspaceTab/WorkspaceTab';
import { AiTab } from './components/tabs/AiTab/AiTab';
import { SessionsTab } from './components/tabs/SessionsTab/SessionsTab';
import { SettingsTab } from './components/tabs/SettingsTab/SettingsTab';
import { useSource, SOURCE_OPTIONS, type SourceFilter } from './hooks/useSource';
import { useLiveData } from './hooks/useLiveData';
import { useLimits } from './hooks/useLimits';
import { useSidebarTabs } from './hooks/useSidebarTabs';
import { useDashboardNotifications } from './hooks/useDashboardNotifications';

type Tab = 'live' | 'agents' | 'workflows' | 'trends' | 'models' | 'insights' | 'workspace' | 'ai' | 'sessions' | 'settings';

// `settings` must stay last — it's pinned to the bottom of the sidebar nav.
// Icons are a separate field so the sidebar can align them in a fixed-width slot
// (emoji glyphs render at different widths, which otherwise misaligns the labels).
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

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const seg = location.pathname.replace(/^\//, '');
  const activeTab: Tab = TABS.some((t) => t.id === seg) ? (seg as Tab) : 'live';

  const { source, setSource, coworkAvailable } = useSource();
  const { recent, weekly, version } = useLiveData();
  const [limits, setLimits] = useLimits();
  const sidebarTabs = useSidebarTabs(TABS);
  useDashboardNotifications(activeTab, limits);

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
            {coworkAvailable && (
              <div
                className="flex items-center gap-2"
                title="Filter usage by surface: Claude Code CLI vs Cowork (desktop local-agent mode)"
              >
                <span className="text-[11px] uppercase tracking-wide text-zinc-600">source</span>
                <ToggleGroup<SourceFilter> options={SOURCE_OPTIONS} value={source} onChange={setSource} />
              </div>
            )}
            <LiveBadge error={error} />
          </header>

          {activeTab === 'settings' ? (
            <SettingsTab limits={limits} onChangeLimits={setLimits} />
          ) : empty ? (
            <div className="card mt-6 p-12 text-center text-zinc-400">
              No usage logs found. Use Claude Code, then this dashboard will populate.
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
        </div>
      </main>
    </div>
  );
}
