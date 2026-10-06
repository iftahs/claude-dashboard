import { useMemo } from 'react';
import { useAiInsightCtx } from './useAiInsightContext';
import { useConfigMode } from './useConfigMode';
import { useLiveData } from './useLiveData';
import { usePolling } from './usePolling';
import { useSource } from './useSource';
import { titleScope } from '@/lib/platform';
import {
  EMPTY_INVENTORY_BODY,
  EMPTY_TASKS_BODY,
  INVENTORY_DESCRIPTION,
  INVENTORY_HELP,
  TASKS_DESCRIPTION,
  TASKS_HELP,
  WORKSPACE_DESCRIPTION,
  buildClaudeProfile,
  buildCodexProfile,
  buildInventory,
  buildTasks,
  inventoryState,
  tasksState,
  workspaceSource,
  type InventorySectionView,
  type ProfileCardView,
  type TasksSectionView,
} from '@/lib/views/workspace';
import type { CodexConfigData, InventoryData, WorkspaceTasksData } from '@/types';

export interface WorkspacePageView {
  description: string;
  profiles: ProfileCardView[];
  inventory: InventorySectionView;
  tasks: TasksSectionView;
}

const CONFIG_ERROR = 'The dashboard server did not answer';

export function useWorkspacePage(): WorkspacePageView {
  const { sectionAi } = useAiInsightCtx();
  const { platform, showClaude, showCodex } = useSource();
  const { configData, configLoading, isApi } = useConfigMode();
  const { codexLive } = useLiveData();

  const source = workspaceSource(platform);
  const workspaceTasks = usePolling<WorkspaceTasksData>(`/api/workspace/tasks?source=${source}`, 60000);
  const inventory = usePolling<InventoryData>(`/api/workspace/inventory?source=${source}`, 120000);
  const codexConfig = usePolling<CodexConfigData>(showCodex ? '/api/codex/config' : '', 120000);

  const claudeProfile = useMemo(
    () =>
      showClaude
        ? buildClaudeProfile({ data: configData, loading: configLoading, error: configData || configLoading ? null : CONFIG_ERROR }, isApi)
        : null,
    [showClaude, configData, configLoading, isApi],
  );

  const codexLiveData = codexLive.data && !codexLive.data.error ? codexLive.data : null;
  const codexProfile = useMemo(
    () =>
      showCodex
        ? buildCodexProfile({ data: codexConfig.data, loading: codexConfig.loading, error: codexConfig.error }, codexLiveData)
        : null,
    [showCodex, codexConfig.data, codexConfig.loading, codexConfig.error, codexLiveData],
  );

  const profiles = useMemo(
    () => [claudeProfile, codexProfile].filter((profile): profile is ProfileCardView => profile !== null),
    [claudeProfile, codexProfile],
  );

  const inventoryBody = useMemo(() => (inventory.data ? buildInventory(inventory.data) : null), [inventory.data]);
  const inventoryAi = useMemo(() => sectionAi('plugins', inventory.data), [sectionAi, inventory.data]);
  const inventoryView = useMemo<InventorySectionView>(
    () => ({
      title: `Plugins and MCP${titleScope(platform)}`,
      description: INVENTORY_DESCRIPTION[platform],
      help: INVENTORY_HELP[platform],
      state: inventoryState({ data: inventory.data, loading: inventory.loading, error: inventory.error }, inventoryBody),
      ai: inventoryAi,
      ...(inventoryBody ?? EMPTY_INVENTORY_BODY),
    }),
    [platform, inventory.data, inventory.loading, inventory.error, inventoryBody, inventoryAi],
  );

  const tasksBody = useMemo(
    () => (workspaceTasks.data ? buildTasks(workspaceTasks.data, platform) : null),
    [workspaceTasks.data, platform],
  );
  const tasksAi = useMemo(() => sectionAi('tasks', workspaceTasks.data), [sectionAi, workspaceTasks.data]);
  const tasksView = useMemo<TasksSectionView>(
    () => ({
      title: `Tasks and plans${titleScope(platform)}`,
      description: TASKS_DESCRIPTION[platform],
      help: TASKS_HELP[platform],
      state: tasksState({ data: workspaceTasks.data, loading: workspaceTasks.loading, error: workspaceTasks.error }, platform),
      ai: tasksAi,
      ...(tasksBody ?? EMPTY_TASKS_BODY),
    }),
    [platform, workspaceTasks.data, workspaceTasks.loading, workspaceTasks.error, tasksBody, tasksAi],
  );

  return { description: WORKSPACE_DESCRIPTION[platform], profiles, inventory: inventoryView, tasks: tasksView };
}
