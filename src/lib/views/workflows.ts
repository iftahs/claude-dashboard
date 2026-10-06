import { formatElapsed } from '@/lib/agents';
import { compact, dayLabel, shortModel, timeAgoOrDate, toolLabel, usd } from '@/lib/format';
import type { SectionState } from '@/lib/section';
import type { WeekStart } from '@/lib/week';
import type {
  WorkflowAgentDetail,
  WorkflowAgentInfo,
  WorkflowAgentState,
  WorkflowRun,
  WorkflowStats,
  WorkflowsData,
} from '@/types';

export interface DateBucket {
  label: string;
  runs: WorkflowRun[];
}

export interface PhaseGroup {
  title: string;
  detail: string;
  agents: WorkflowAgentInfo[];
  done: number;
  total: number;
}

export interface WorkflowAgentDetailState {
  data: WorkflowAgentDetail | null;
  loading: boolean;
  error: string | null;
}

export type WorkflowFactTone = 'default' | 'muted' | 'warning' | 'danger';

export interface WorkflowFactView {
  key: string;
  label: string;
  value: string;
  tone: WorkflowFactTone;
  help: string | null;
}

export interface WorkflowToolView {
  name: string;
  label: string;
  count: number;
  percent: number;
  failed: string | null;
}

export interface WorkflowFileView {
  path: string;
  name: string;
}

export type WorkflowDetailStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface WorkflowAgentDetailView {
  status: WorkflowDetailStatus;
  error: string | null;
  facts: WorkflowFactView[];
  tokens: WorkflowFactView[];
  tags: string[];
  prompt: string;
  result: string;
  files: WorkflowFileView[];
  tools: WorkflowToolView[];
}

export interface WorkflowAgentRowView {
  key: string;
  agentId: string;
  label: string;
  type: string;
  attempt: string | null;
  model: string;
  state: WorkflowAgentState;
  stateLabel: string;
  metrics: string;
  runningSince: number | null;
  open: boolean;
  detail: WorkflowAgentDetailView | null;
}

export type WorkflowPhaseState = 'done' | 'running' | 'partial' | 'pending';

export interface WorkflowPhaseView {
  key: string;
  index: number;
  title: string;
  state: WorkflowPhaseState;
  count: string | null;
  selected: boolean;
}

export interface WorkflowPhaseSelectionView {
  title: string;
  summary: string;
  agents: WorkflowAgentRowView[];
}

export interface WorkflowPanesView {
  runId: string;
  phases: WorkflowPhaseView[];
  note: string | null;
  selected: WorkflowPhaseSelectionView | null;
}

export interface WorkflowLiveRunView {
  runId: string;
  name: string;
  summary: string;
  live: boolean;
  progress: string;
  startedAt: number;
  duration: string;
  panes: WorkflowPanesView;
}

export type WorkflowStatusTone = 'success' | 'danger' | 'accent' | 'neutral';

export interface WorkflowResultStatView {
  key: string;
  label: string;
  value: string;
}

export interface WorkflowRecentRunView {
  runId: string;
  name: string;
  summary: string;
  status: WorkflowRun['status'];
  statusLabel: string;
  statusTone: WorkflowStatusTone;
  model: string | null;
  when: string;
  meta: string[];
  cost: string | null;
  costHelp: string;
  resultStats: WorkflowResultStatView[];
  expandable: boolean;
  open: boolean;
  panes: WorkflowPanesView | null;
  log: string[];
}

export interface WorkflowRunGroupView {
  label: string;
  runs: WorkflowRecentRunView[];
}

export interface WorkflowRunsView {
  state: SectionState | null;
  liveNote: string;
  live: WorkflowLiveRunView[];
  groups: WorkflowRunGroupView[];
}

export type WorkflowStatTone = 'default' | 'success';

export interface WorkflowStatView {
  key: string;
  label: string;
  value: string;
  sub: string | null;
  tone: WorkflowStatTone;
  help: string | null;
}

export type WorkflowStatsStatus = 'loading' | 'error' | 'hidden' | 'ready';

export interface WorkflowStatsView {
  status: WorkflowStatsStatus;
  tiles: WorkflowStatView[];
  errorTitle: string;
  errorDescription: string;
}

export interface WorkflowUiState {
  pinnedPhases: ReadonlyMap<string, number>;
  openRuns: ReadonlySet<string>;
  openAgents: ReadonlySet<string>;
  details: ReadonlyMap<string, WorkflowAgentDetailState>;
}

export interface WorkflowRunsInput {
  data: WorkflowsData | null;
  loading: boolean;
  error: string | null;
  weekStart: WeekStart;
  ui: WorkflowUiState;
}

export interface WorkflowStatsInput {
  stats: WorkflowStats | null;
  loading: boolean;
  error: string | null;
}

export interface WatchedAgent {
  key: string;
  runId: string;
  agentId: string;
  running: boolean;
}

export const WORKFLOWS_DESCRIPTION = 'Multi-agent workflow runs, live and recent, with their phases and agents.';

export const WORKFLOWS_HELP =
  'Dynamic workflow runs (the Workflow orchestration tool). Live runs show their phases and per-phase agents, tokens and elapsed time; recent runs list completed runs grouped by date. The stat tiles aggregate every workflow run on disk. Mirrors what /workflows shows in Claude Code.';

export const WORKFLOWS_CLAUDE_ONLY_NOTE = 'Claude Code only. Codex records no workflow runs, so this page shows the Claude side.';

export const STAT_TILE_COUNT = 9;

const DAY_MS = 86_400_000;
const DASH = '—';
const SERVER_DOWN = 'The dashboard server did not answer. It keeps retrying.';
const EST_COST_HELP =
  'Rough equivalent-API estimate. Workflow journals store only combined effective tokens (no input/output split), so this is a blended approximation, not a real bill.';
const CACHE_READ_HELP = "Cache reads are excluded from effective tokens. They don't count toward rate limits.";
const COST_HELP: Record<WorkflowRun['costBasis'], string> = {
  'per-agent': 'Estimated equivalent-API cost, priced per subagent model.',
  'blended-run': 'Estimated equivalent-API cost at one blended rate for the whole run. Coarse.',
};
const STATUS_LABEL: Record<WorkflowRun['status'], string> = {
  completed: 'Completed',
  failed: 'Failed',
  running: 'Running',
  unknown: 'Unknown',
};
const STATUS_TONE: Record<WorkflowRun['status'], WorkflowStatusTone> = {
  completed: 'success',
  failed: 'danger',
  running: 'accent',
  unknown: 'neutral',
};
const AGENT_STATE_LABEL: Record<WorkflowAgentState, string> = {
  done: 'Done',
  running: 'Running',
  queued: 'Queued',
  error: 'Failed',
  stalled: 'Stalled',
};
const FIXED_BUCKETS = ['Today', 'Yesterday', 'Earlier this week', 'Earlier this month'];

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function durationLabel(ms: number): string {
  return formatElapsed(Math.floor(ms / 1000));
}

export function agentDetailKey(runId: string, agentId: string): string {
  return `${runId}:${agentId}`;
}

export function humanize(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, (_, before: string, upper: string) => `${before} ${upper.toLowerCase()}`)
    .replace(/\b(url|api|id|mcp|ai)\b/gi, (match) => match.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function queueLabel(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// Buckets by startedAt in local time: Today, Yesterday, Earlier this week, Earlier this month, then "<Month YYYY>" newest first.
export function groupRunsByDate(runs: WorkflowRun[], weekStart: WeekStart): DateBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startToday = today.getTime();
  const startYesterday = startToday - DAY_MS;
  const weekOffset = weekStart === 'sunday' ? today.getDay() : (today.getDay() + 6) % 7;
  const startWeek = startToday - weekOffset * DAY_MS;
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();

  const labelOf = (ts: number): string => {
    if (ts >= startToday) return 'Today';
    if (ts >= startYesterday) return 'Yesterday';
    if (ts >= startWeek) return 'Earlier this week';
    if (ts >= startMonth) return 'Earlier this month';
    return new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const byLabel = new Map<string, WorkflowRun[]>();
  for (const run of [...runs].sort((a, b) => b.startedAt - a.startedAt)) {
    const label = labelOf(run.startedAt);
    const bucket = byLabel.get(label);
    if (bucket) bucket.push(run);
    else byLabel.set(label, [run]);
  }

  const buckets: DateBucket[] = [];
  for (const label of FIXED_BUCKETS) {
    const bucket = byLabel.get(label);
    if (bucket) {
      buckets.push({ label, runs: bucket });
      byLabel.delete(label);
    }
  }
  for (const [label, bucket] of byLabel) buckets.push({ label, runs: bucket });
  return buckets;
}

// Phases from run.phases come first (even with no agent seen yet); a phaseTitle only seen on an agent is appended in first-seen order.
export function buildPhaseGroups(run: WorkflowRun): PhaseGroup[] {
  const byTitle = new Map<string, WorkflowAgentInfo[]>();
  for (const agent of run.agents) {
    const key = agent.phaseTitle || '';
    const list = byTitle.get(key);
    if (list) list.push(agent);
    else byTitle.set(key, [agent]);
  }

  const groups: PhaseGroup[] = [];
  const used = new Set<string>();
  const push = (key: string, title: string, detail: string) => {
    const agents = byTitle.get(key) ?? [];
    groups.push({ title, detail, agents, done: agents.filter((agent) => agent.state === 'done').length, total: agents.length });
  };

  for (const phase of run.phases) {
    used.add(phase.title);
    push(phase.title, phase.title, phase.detail);
  }
  for (const agent of run.agents) {
    const key = agent.phaseTitle || '';
    if (used.has(key)) continue;
    used.add(key);
    push(key, key || 'Ungrouped', '');
  }
  return groups;
}

export function defaultActivePhaseIndex(groups: PhaseGroup[]): number {
  const running = groups.findIndex((group) => group.agents.some((agent) => agent.state === 'running'));
  if (running !== -1) return running;
  let lastWithAgents = -1;
  for (let i = 0; i < groups.length; i += 1) if (groups[i].total > 0) lastWithAgents = i;
  return lastWithAgents === -1 ? 0 : lastWithAgents;
}

export function doneAgentCount(run: WorkflowRun): number {
  return run.agents.filter((agent) => agent.state === 'done').length;
}

// Pass 0 as the override to drop the static elapsed part when a live ticker renders it instead.
export function agentMetrics(agent: WorkflowAgentInfo, elapsedSecOverride?: number): string {
  const parts: string[] = [];
  if (agent.tokens > 0) parts.push(`${compact(agent.tokens)} tok`);
  if (agent.toolCalls > 0) parts.push(`${agent.toolCalls} ${plural(agent.toolCalls, 'tool', 'tools')}`);
  const sec = elapsedSecOverride ?? Math.floor(agent.durationMs / 1000);
  if (sec > 0) parts.push(formatElapsed(sec));
  return parts.join(' · ');
}

function fact(key: string, label: string, value: string, tone: WorkflowFactTone = 'default', help: string | null = null): WorkflowFactView {
  return { key, label, value, tone, help };
}

const NO_DETAIL: Omit<WorkflowAgentDetailView, 'status' | 'error'> = {
  facts: [],
  tokens: [],
  tags: [],
  prompt: '',
  result: '',
  files: [],
  tools: [],
};

function detailView(state: WorkflowAgentDetailState | undefined): WorkflowAgentDetailView {
  const detail = state?.data ?? null;
  if (state?.error) return { ...NO_DETAIL, status: 'error', error: state.error.replace(/^Error:\s*/, '') };
  if (!detail) return { ...NO_DETAIL, status: !state || state.loading ? 'loading' : 'empty', error: null };

  const facts: WorkflowFactView[] = [];
  if (detail.index > 0) facts.push(fact('index', 'Agent', `#${detail.index}`));
  if (detail.agentType) facts.push(fact('type', 'Type', detail.agentType));
  if (detail.queuedMs > 0) facts.push(fact('queued', 'Queued', queueLabel(detail.queuedMs), detail.queuedMs > 1000 ? 'warning' : 'default'));
  facts.push(fact('turns', 'Turns', String(detail.turns)));
  if (detail.attempt > 1) facts.push(fact('attempt', 'Attempt', String(detail.attempt), 'warning'));
  if (detail.toolFailures > 0) facts.push(fact('toolErrors', 'Tool errors', String(detail.toolFailures), 'danger'));

  const max = detail.tools.reduce((top, tool) => Math.max(top, tool.count), 0) || 1;
  return {
    status: 'ready',
    error: null,
    facts,
    tokens: [
      fact('input', 'In', compact(detail.tokens.input)),
      fact('output', 'Out', compact(detail.tokens.output)),
      fact('cacheCreate', 'Cache write', compact(detail.tokens.cacheCreate)),
      fact('cacheRead', 'Cache read', compact(detail.tokens.cacheRead), 'muted', CACHE_READ_HELP),
    ],
    tags: [...detail.skills.map((skill) => `skill: ${skill}`), ...detail.mcpServers.map((server) => `mcp: ${server}`)],
    prompt: detail.prompt,
    result: detail.resultSummary,
    files: detail.resultFiles.map((path) => ({ path, name: path.split(/[\\/]/).pop() || path })),
    tools: detail.tools.map((tool) => ({
      name: tool.name,
      label: toolLabel(tool.name),
      count: tool.count,
      percent: (tool.count / max) * 100,
      failed: tool.failed > 0 ? `${tool.failed} failed` : null,
    })),
  };
}

function agentRow(run: WorkflowRun, agent: WorkflowAgentInfo, ui: WorkflowUiState): WorkflowAgentRowView {
  const key = agentDetailKey(run.runId, agent.agentId);
  const running = agent.state === 'running';
  const open = ui.openAgents.has(key);
  return {
    key,
    agentId: agent.agentId,
    label: agent.label || 'agent',
    type: agent.agentType,
    attempt: agent.attempt > 1 ? `×${agent.attempt}` : null,
    model: agent.model,
    state: agent.state,
    stateLabel: AGENT_STATE_LABEL[agent.state] ?? AGENT_STATE_LABEL.running,
    metrics: agentMetrics(agent, running ? 0 : undefined),
    runningSince: running ? agent.startedAt : null,
    open,
    detail: open ? detailView(ui.details.get(key)) : null,
  };
}

function phaseState(group: PhaseGroup): WorkflowPhaseState {
  if (group.agents.some((agent) => agent.state === 'running')) return 'running';
  if (group.total === 0) return 'pending';
  return group.done === group.total ? 'done' : 'partial';
}

function panesView(run: WorkflowRun, ui: WorkflowUiState, showNote: boolean): WorkflowPanesView {
  const groups = buildPhaseGroups(run);
  const wanted = ui.pinnedPhases.get(run.runId) ?? defaultActivePhaseIndex(groups);
  const selectedIndex = Math.min(Math.max(0, wanted), Math.max(0, groups.length - 1));
  const selected = groups[selectedIndex];
  return {
    runId: run.runId,
    phases: groups.map((group, index) => ({
      key: `${group.title}-${index}`,
      index,
      title: group.title,
      state: phaseState(group),
      count: group.total > 0 ? `${group.done}/${group.total}` : null,
      selected: index === selectedIndex,
    })),
    note: showNote && run.runningAgents > 0 ? `${run.runningAgents} running` : null,
    selected: selected
      ? {
          title: selected.title,
          summary: `${selected.agents.length} ${plural(selected.agents.length, 'agent', 'agents')}`,
          agents: selected.agents.map((agent) => agentRow(run, agent, ui)),
        }
      : null,
  };
}

function liveRun(run: WorkflowRun, ui: WorkflowUiState): WorkflowLiveRunView {
  return {
    runId: run.runId,
    name: run.name,
    summary: run.summary && run.summary !== run.name ? run.summary : '',
    live: run.isLive,
    progress: `${doneAgentCount(run)} of ${run.agentCount} ${plural(run.agentCount, 'agent', 'agents')}`,
    startedAt: run.startedAt,
    duration: durationLabel(run.durationMs),
    panes: panesView(run, ui, run.isLive),
  };
}

function recentRun(run: WorkflowRun, ui: WorkflowUiState): WorkflowRecentRunView {
  const log = run.logsTail ?? [];
  const expandable = run.agents.length > 0 || log.length > 0;
  const open = expandable && ui.openRuns.has(run.runId);
  const hasModel = !!run.defaultModel && run.defaultModel !== 'inherit' && run.defaultModel !== 'unknown';
  const meta: string[] = [];
  if (run.project) meta.push(run.project);
  meta.push(durationLabel(run.durationMs));
  meta.push(`${run.agentCount} ${plural(run.agentCount, 'agent', 'agents')}`);
  meta.push(`${compact(run.tokens)} tok`);
  if (run.toolCalls > 0) meta.push(`${run.toolCalls} ${plural(run.toolCalls, 'tool call', 'tool calls')}`);
  if (run.phaseTotal != null) meta.push(`${run.phaseTotal} ${plural(run.phaseTotal, 'phase', 'phases')}`);
  return {
    runId: run.runId,
    name: run.name,
    summary: run.summary && run.summary !== run.name ? run.summary : '',
    status: run.status,
    statusLabel: STATUS_LABEL[run.status] ?? STATUS_LABEL.unknown,
    statusTone: STATUS_TONE[run.status] ?? STATUS_TONE.unknown,
    model: hasModel ? run.defaultModel : null,
    when: timeAgoOrDate(run.lastActivity),
    meta,
    cost: run.cost > 0 ? `~${usd(run.cost)}` : null,
    costHelp: COST_HELP[run.costBasis] ?? COST_HELP['blended-run'],
    resultStats: Object.entries(run.resultStats ?? {}).map(([key, value]) => ({ key, label: humanize(key), value: String(value) })),
    expandable,
    open,
    panes: open && run.agents.length > 0 ? panesView(run, ui, false) : null,
    log: open ? log : [],
  };
}

export function buildWorkflowRuns({ data, loading, error, weekStart, ui }: WorkflowRunsInput): WorkflowRunsView {
  const live = data?.live ?? [];
  const recent = data?.recent ?? [];

  let state: SectionState | null = null;
  if (!data && loading) state = { kind: 'loading', skeleton: 'bars', rows: 3 };
  else if (!data && error) state = { kind: 'error', title: 'Could not load workflow runs', description: SERVER_DOWN };
  else if (live.length === 0 && recent.length === 0) {
    state = { kind: 'empty', icon: 'workflow', title: 'No workflows yet', description: 'Run one in Claude Code and it shows up here.' };
  }

  return {
    state,
    liveNote: `${live.length} running`,
    live: live.map((run) => liveRun(run, ui)),
    groups: groupRunsByDate(recent, weekStart).map((bucket) => ({
      label: bucket.label,
      runs: bucket.runs.map((run) => recentRun(run, ui)),
    })),
  };
}

function tile(key: string, label: string, value: string, sub: string | null = null, tone: WorkflowStatTone = 'default', help: string | null = null): WorkflowStatView {
  return { key, label, value, sub, tone, help };
}

export function buildWorkflowStats({ stats, loading, error }: WorkflowStatsInput): WorkflowStatsView {
  const base = { tiles: [], errorTitle: 'Could not load workflow totals', errorDescription: SERVER_DOWN };
  if (!stats) return { ...base, status: loading ? 'loading' : error ? 'error' : 'hidden' };
  if (stats.totalRuns === 0) return { ...base, status: 'hidden' };

  const rated = stats.completed + stats.failed > 0;
  const busiest = stats.busiestDay;
  return {
    ...base,
    status: 'ready',
    tiles: [
      tile('runs', 'Runs', compact(stats.totalRuns)),
      tile(
        'success',
        'Success rate',
        rated ? `${Math.round(stats.successRate * 100)}%` : DASH,
        `${stats.completed} completed, ${stats.failed} failed`,
        'success',
      ),
      tile('tokens', 'Total tokens', compact(stats.totalTokens)),
      tile('agents', 'Agents spawned', compact(stats.totalAgents)),
      tile('duration', 'Avg duration', stats.avgDurationMs > 0 ? formatElapsed(Math.round(stats.avgDurationMs / 1000)) : DASH),
      tile('cost', 'Est. cost', stats.estCostUsd > 0 ? `~${usd(stats.estCostUsd)}` : DASH, 'Blended estimate', 'default', EST_COST_HELP),
      tile('tools', 'Tool calls', compact(stats.totalToolCalls)),
      tile('model', 'Top model', stats.topModel && stats.topModel !== 'inherit' ? shortModel(stats.topModel) : DASH),
      tile(
        'busiest',
        'Busiest day',
        busiest ? dayLabel(busiest.day) : DASH,
        busiest ? `${busiest.count} ${plural(busiest.count, 'run', 'runs')}` : null,
      ),
    ],
  };
}

function openAgentsOf(panes: WorkflowPanesView | null): WatchedAgent[] {
  if (!panes?.selected) return [];
  return panes.selected.agents
    .filter((agent) => agent.open)
    .map((agent) => ({ key: agent.key, runId: panes.runId, agentId: agent.agentId, running: agent.state === 'running' }));
}

// Only rows that are open and on screen: a detail request parses a whole transcript.
export function watchedAgents(view: WorkflowRunsView): WatchedAgent[] {
  return [
    ...view.live.flatMap((run) => openAgentsOf(run.panes)),
    ...view.groups.flatMap((group) => group.runs.flatMap((run) => openAgentsOf(run.panes))),
  ];
}
