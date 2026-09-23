import { Section } from '@/components/design-system/molecules/Section/Section';
import { ConfigProfile } from '@/components/design-system/organisms/ConfigProfile/ConfigProfile';
import { claudeProfileView, codexProfileView } from '@/components/design-system/organisms/ConfigProfile/utils';
import type { ConfigProfileView } from '@/components/design-system/organisms/ConfigProfile/types';
import { TasksPanel } from '@/components/design-system/organisms/TasksPanel/TasksPanel';
import { PluginsInventory } from '@/components/design-system/organisms/PluginsInventory/PluginsInventory';
import { usePolling } from '@/hooks/usePolling';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import { useConfigMode } from '@/hooks/useConfigMode';
import { useLiveData } from '@/hooks/useLiveData';
import { useSource } from '@/hooks/useSource';
import { titleScope } from '@/lib/platform';
import type { CodexConfigData, InventoryData, WorkspaceTasksData } from '@/types';
import { EMPTY_TASKS, INVENTORY_HELP, TASKS_HELP, workspaceSource } from './utils';

/**
 * The Workspace tab, one layout on every platform:
 *
 *   [ Config profile | Plugins & MCP ]
 *   [ Tasks & plans                  ]
 *
 * Claude reads ~/.claude, Codex reads ~/.codex (config.toml, skills, plans,
 * automations). Under Both the profile column stacks the two profiles and the
 * inventory and plans are merged, each item tagged with its platform.
 */
export function WorkspaceTab() {
  const { aiProps } = useAiInsightCtx();
  const { platform, showClaude, showCodex } = useSource();
  const { configData, isApi } = useConfigMode();
  const { codexLive } = useLiveData();

  const source = workspaceSource(platform);
  const workspaceTasks = usePolling<WorkspaceTasksData>(`/api/workspace/tasks?source=${source}`, 60000);
  const inventory = usePolling<InventoryData>(`/api/workspace/inventory?source=${source}`, 120000);
  const codexConfig = usePolling<CodexConfigData>(showCodex ? '/api/codex/config' : '', 120000);

  // One profile card per platform on screen (null = still loading → skeleton).
  const profiles: { key: string; view: ConfigProfileView | null }[] = [];
  if (showClaude) profiles.push({ key: 'claude', view: configData ? claudeProfileView(configData, isApi) : null });
  if (showCodex) {
    const live = codexLive.data && !codexLive.data.error ? codexLive.data : null;
    profiles.push({ key: 'codex', view: codexConfig.data ? codexProfileView(codexConfig.data, live) : null });
  }

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6">
          {profiles.map((p) => (
            <ConfigProfile key={p.key} profile={p.view} />
          ))}
        </div>
        <Section
          className="lg:col-span-2"
          title={`Plugins & MCP · installed integrations${titleScope(platform)}`}
          help={INVENTORY_HELP[platform]}
          {...aiProps('plugins', inventory.data)}
        >
          <PluginsInventory data={inventory.data} />
        </Section>
      </div>
      <Section
        title={`Tasks & plans${titleScope(platform)}`}
        help={TASKS_HELP[platform]}
        {...aiProps('tasks', workspaceTasks.data)}
      >
        <TasksPanel data={workspaceTasks.data} emptyTasks={EMPTY_TASKS[platform]} />
      </Section>
    </>
  );
}
