import { useMemo } from 'react';
import { useLiveData } from './useLiveData';
import { usePolling } from './usePolling';
import { useSource } from './useSource';
import { toDisplayAgents } from '@/lib/agents';
import {
  AGENT_HISTORY_DAYS,
  AGENTS_PAGE_DESCRIPTION,
  buildAgentActivity,
  buildAgentHistory,
  type AgentActivityView,
  type AgentHistoryView,
} from '@/lib/views/agents';
import type { SubagentStats } from '@/types';

export interface AgentsPageView {
  description: string;
  activity: AgentActivityView[];
  history: AgentHistoryView[];
}

const HISTORY_POLL_MS = 60_000;

// Platform-scoped, not surface-scoped: history asks for source=claude explicitly so it matches the live feed whatever the Code/Cowork toggle says.
export function useAgentsPage(): AgentsPageView {
  const { platform, showClaude, showCodex } = useSource();
  const { liveSubagents, codexAgents } = useLiveData();

  const claudeHistory = usePolling<SubagentStats>(
    showClaude ? `/api/insights/subagents?days=${AGENT_HISTORY_DAYS}&source=claude` : '',
    HISTORY_POLL_MS,
  );
  const codexHistory = usePolling<SubagentStats>(
    showCodex ? `/api/insights/subagents?days=${AGENT_HISTORY_DAYS}&source=codex` : '',
    HISTORY_POLL_MS,
  );

  // Once per poll result, not per render: the 2.5s poll hands back a new object each tick.
  const claudeAgents = useMemo(() => toDisplayAgents(liveSubagents.data), [liveSubagents.data]);
  const codexThreads = useMemo(() => toDisplayAgents(codexAgents.data), [codexAgents.data]);

  const claudeActivity = useMemo(
    () =>
      showClaude
        ? buildAgentActivity({
            platform: 'claude',
            scope: platform,
            data: claudeAgents,
            loading: liveSubagents.loading,
            error: liveSubagents.error,
          })
        : null,
    [showClaude, platform, claudeAgents, liveSubagents.loading, liveSubagents.error],
  );
  const codexActivity = useMemo(
    () =>
      showCodex
        ? buildAgentActivity({
            platform: 'codex',
            scope: platform,
            data: codexThreads,
            loading: codexAgents.loading,
            error: codexAgents.error,
          })
        : null,
    [showCodex, platform, codexThreads, codexAgents.loading, codexAgents.error],
  );

  const claudeStrip = useMemo(
    () =>
      showClaude
        ? buildAgentHistory({
            platform: 'claude',
            scope: platform,
            data: claudeHistory.data,
            loading: claudeHistory.loading,
            error: claudeHistory.error,
          })
        : null,
    [showClaude, platform, claudeHistory.data, claudeHistory.loading, claudeHistory.error],
  );
  const codexStrip = useMemo(
    () =>
      showCodex
        ? buildAgentHistory({
            platform: 'codex',
            scope: platform,
            data: codexHistory.data,
            loading: codexHistory.loading,
            error: codexHistory.error,
          })
        : null,
    [showCodex, platform, codexHistory.data, codexHistory.loading, codexHistory.error],
  );

  const activity = useMemo(
    () => [claudeActivity, codexActivity].filter((view): view is AgentActivityView => view !== null),
    [claudeActivity, codexActivity],
  );
  const history = useMemo(
    () => [claudeStrip, codexStrip].filter((view): view is AgentHistoryView => view !== null),
    [claudeStrip, codexStrip],
  );

  return {
    description: AGENTS_PAGE_DESCRIPTION[platform],
    activity,
    history,
  };
}
