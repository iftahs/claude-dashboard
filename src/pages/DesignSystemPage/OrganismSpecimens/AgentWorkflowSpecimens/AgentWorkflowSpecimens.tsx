import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import { AgentActivity } from '@/components/design-system/organisms/AgentActivity/AgentActivity';
import { AgentHistoryStrip } from '@/components/design-system/organisms/AgentHistoryStrip/AgentHistoryStrip';
import { RunningNow } from '@/components/design-system/organisms/RunningNow/RunningNow';
import { WorkflowRunCard } from '@/components/design-system/organisms/WorkflowRunCard/WorkflowRunCard';
import { WorkflowRunRow } from '@/components/design-system/organisms/WorkflowRunRow/WorkflowRunRow';
import { WorkflowStatsGrid } from '@/components/design-system/organisms/WorkflowStatsGrid/WorkflowStatsGrid';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { StatGridLayout } from '@/components/design-system/templates/StatGridLayout/StatGridLayout';
import { agentDetailKey, buildWorkflowRuns } from '@/lib/views/workflows';
import { Specimen } from '../../Specimen/Specimen';
import {
  ACTIVITY_VIEWS,
  HISTORY_VIEWS,
  HISTORY_WIDE_VIEW,
  INITIAL_OPEN_AGENTS,
  INITIAL_OPEN_RUNS,
  INITIAL_PINNED,
  RUNNING_VIEWS,
  SPECIMEN_DETAILS,
  SPECIMEN_WORKFLOWS,
  STATS_VIEWS,
} from './utils';

function ignoreRetry(): void {}

function stayOnPage(event: MouseEvent<HTMLAnchorElement>): void {
  event.preventDefault();
}

function toggled(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}

export function AgentWorkflowSpecimens() {
  const [pinnedPhases, setPinnedPhases] = useState(INITIAL_PINNED);
  const [openRuns, setOpenRuns] = useState(INITIAL_OPEN_RUNS);
  const [openAgents, setOpenAgents] = useState(INITIAL_OPEN_AGENTS);

  const onSelectPhase = useCallback((runId: string, index: number) => setPinnedPhases((prev) => new Map(prev).set(runId, index)), []);
  const onToggleRun = useCallback((runId: string) => setOpenRuns((prev) => toggled(prev, runId)), []);
  const onToggleAgent = useCallback(
    (runId: string, agentId: string) => setOpenAgents((prev) => toggled(prev, agentDetailKey(runId, agentId))),
    [],
  );

  const runs = useMemo(
    () =>
      buildWorkflowRuns({
        data: SPECIMEN_WORKFLOWS,
        loading: false,
        error: null,
        weekStart: 'monday',
        ui: { pinnedPhases, openRuns, openAgents, details: SPECIMEN_DETAILS },
      }),
    [pinnedPhases, openRuns, openAgents],
  );

  return (
    <>
      <Specimen
        name="RunningNow"
        note="A waiting row, running sessions, a workflow and a subagent, then nothing running, loading and failed"
        layout="stack"
      >
        {RUNNING_VIEWS.map((view, index) => (
          <RunningNow key={index} view={view} href="/agents" onNavigate={stayOnPage} />
        ))}
      </Specimen>
      <Specimen
        name="AgentActivity"
        note="Every main-session state with nested and orphan subagents, then loading, failed and empty"
        layout="stack"
      >
        {ACTIVITY_VIEWS.map((view, index) => (
          <AgentActivity key={index} view={view} />
        ))}
      </Specimen>
      <Specimen name="AgentHistoryStrip" note="Full width, then half width: ready, empty, loading and failed" layout="stack">
        <AgentHistoryStrip view={HISTORY_WIDE_VIEW} />
        <SplitLayout>
          {HISTORY_VIEWS.map((view, index) => (
            <AgentHistoryStrip key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="WorkflowStatsGrid" note="The nine totals, their skeleton tiles and the failed state" layout="stack">
        {STATS_VIEWS.map((view, index) => (
          <StatGridLayout key={index} columns={3}>
            <WorkflowStatsGrid view={view} />
          </StatGridLayout>
        ))}
      </Specimen>
      <Specimen
        name="WorkflowRunCard"
        note="A live run with WorkflowPhasePanes: pick a phase, open an agent. The open rows show a detail that is ready, loading and failed. Critique holds a running, a queued and a stalled agent."
        layout="stack"
      >
        {runs.live.map((run) => (
          <WorkflowRunCard key={run.runId} view={run} onSelectPhase={onSelectPhase} onToggleAgent={onToggleAgent} onRetryAgent={ignoreRetry} />
        ))}
      </Specimen>
      <Specimen name="WorkflowRunRow" note="Completed with its details open, failed, and a run with no details" layout="stack">
        {runs.groups.flatMap((group) =>
          group.runs.map((run) => (
            <WorkflowRunRow key={run.runId} view={run} onToggle={onToggleRun} onSelectPhase={onSelectPhase} onToggleAgent={onToggleAgent} />
          )),
        )}
      </Specimen>
    </>
  );
}
