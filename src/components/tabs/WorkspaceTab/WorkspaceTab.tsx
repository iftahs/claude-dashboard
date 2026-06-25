import { Section } from '@/components/design-system/molecules/Section/Section';
import { TasksPanel } from '@/components/design-system/organisms/TasksPanel/TasksPanel';
import { PluginsInventory } from '@/components/design-system/organisms/PluginsInventory/PluginsInventory';
import { usePolling } from '@/hooks/usePolling';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import type { WorkspaceTasksData, InventoryData } from '@/types';

export function WorkspaceTab() {
  const { aiProps } = useAiInsightCtx();
  const workspaceTasks = usePolling<WorkspaceTasksData>('/api/workspace/tasks', 60000);
  const inventory = usePolling<InventoryData>('/api/workspace/inventory', 120000);

  return (
    <>
      <Section
        title="Tasks & plans"
        help="Tasks tracked by Claude Code's task tooling (completion + blocked) and the plan documents under ~/.claude/plans, with size and age."
        {...aiProps('tasks', workspaceTasks.data)}
      >
        <TasksPanel data={workspaceTasks.data} />
      </Section>
      <Section
        title="Plugins & MCP · installed integrations"
        help="Installed plugins, registered MCP servers (global vs project-scoped), plugin marketplaces and any configured hooks — your local Claude Code integration inventory."
        {...aiProps('plugins', inventory.data)}
      >
        <PluginsInventory data={inventory.data} />
      </Section>
    </>
  );
}
