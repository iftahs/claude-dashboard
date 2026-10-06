import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAgentDetail } from './useAgentDetail';
import { useConfigMode } from './useConfigMode';
import { useLiveData } from './useLiveData';
import { useSource } from './useSource';
import {
  WORKFLOWS_CLAUDE_ONLY_NOTE,
  WORKFLOWS_DESCRIPTION,
  WORKFLOWS_HELP,
  agentDetailKey,
  buildWorkflowRuns,
  buildWorkflowStats,
  watchedAgents,
  type WorkflowRunsView,
  type WorkflowStatsView,
} from '@/lib/views/workflows';

export interface WorkflowsPageView {
  description: string;
  help: string;
  note: string | null;
  stats: WorkflowStatsView;
  runs: WorkflowRunsView;
  onSelectPhase: (runId: string, index: number) => void;
  onToggleRun: (runId: string) => void;
  onToggleAgent: (runId: string, agentId: string) => void;
  onRetryAgent: (runId: string, agentId: string) => void;
}

const DETAIL_REFETCH_MS = 10_000;

// Details fetched while their agent was still running: the cached copy is a snapshot, so the first read after the agent stops is forced.
const fetchedWhileRunning = new Set<string>();

function toggled(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}

export function useWorkflowsPage(): WorkflowsPageView {
  const { platform } = useSource();
  const { workflows, workflowStats } = useLiveData();
  const { weekStart } = useConfigMode();
  const { getAgentDetail, states } = useAgentDetail();

  const [pinnedPhases, setPinnedPhases] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [openRuns, setOpenRuns] = useState<ReadonlySet<string>>(() => new Set());
  const [openAgents, setOpenAgents] = useState<ReadonlySet<string>>(() => new Set());

  // The selected phase follows the active one until the user picks a phase for that run.
  const onSelectPhase = useCallback((runId: string, index: number) => {
    setPinnedPhases((prev) => new Map(prev).set(runId, index));
  }, []);
  const onToggleRun = useCallback((runId: string) => {
    setOpenRuns((prev) => toggled(prev, runId));
  }, []);
  const onToggleAgent = useCallback((runId: string, agentId: string) => {
    setOpenAgents((prev) => toggled(prev, agentDetailKey(runId, agentId)));
  }, []);
  const onRetryAgent = useCallback(
    (runId: string, agentId: string) => getAgentDetail(runId, agentId, true),
    [getAgentDetail],
  );

  const stats = useMemo(
    () => buildWorkflowStats({ stats: workflowStats.data, loading: workflowStats.loading, error: workflowStats.error }),
    [workflowStats.data, workflowStats.loading, workflowStats.error],
  );

  const runs = useMemo(
    () =>
      buildWorkflowRuns({
        data: workflows.data,
        loading: workflows.loading,
        error: workflows.error,
        weekStart,
        ui: { pinnedPhases, openRuns, openAgents, details: states },
      }),
    [workflows.data, workflows.loading, workflows.error, weekStart, pinnedPhases, openRuns, openAgents, states],
  );

  // The detail endpoint parses a whole transcript, so it is fetched only for rows that are open and on screen, and re-fetched only while their agent runs.
  const watched = useMemo(() => watchedAgents(runs), [runs]);
  const watchedRef = useRef(watched);
  watchedRef.current = watched;
  const watchedSignature = watched.map((agent) => `${agent.key}:${agent.running ? 1 : 0}`).join('|');

  useEffect(() => {
    const current = watchedRef.current;
    for (const agent of current) {
      if (agent.running) {
        fetchedWhileRunning.add(agent.key);
        getAgentDetail(agent.runId, agent.agentId);
      } else {
        getAgentDetail(agent.runId, agent.agentId, fetchedWhileRunning.delete(agent.key));
      }
    }
    if (!current.some((agent) => agent.running)) return;
    const id = setInterval(() => {
      for (const agent of watchedRef.current) {
        if (agent.running) getAgentDetail(agent.runId, agent.agentId, true);
      }
    }, DETAIL_REFETCH_MS);
    return () => clearInterval(id);
  }, [watchedSignature, getAgentDetail]);

  return {
    description: WORKFLOWS_DESCRIPTION,
    help: WORKFLOWS_HELP,
    note: platform === 'both' ? WORKFLOWS_CLAUDE_ONLY_NOTE : null,
    stats,
    runs,
    onSelectPhase,
    onToggleRun,
    onToggleAgent,
    onRetryAgent,
  };
}
