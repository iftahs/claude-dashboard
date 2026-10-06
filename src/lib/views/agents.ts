import { isYourTurn, type LiveAgentsData, type LiveMainAgent } from '@/lib/agents';
import { compact } from '@/lib/format';
import { PLATFORM_NOUN, titleScope, type Platform } from '@/lib/platform';
import type { SectionState } from '@/lib/section';
import type { AgentTrafficStatus, LiveSubagent, RecentlyCompletedSubagent, SubagentStats } from '@/types';

export type AgentPlatform = 'claude' | 'codex';

interface AgentLabels {
  mains: string;
  subagents: string;
  otherSubagents: string;
  subagentUnit: [string, string];
  mainUnit: [string, string];
  empty: string;
  waitingHelp: string;
  yourTurnHelp: string;
}

const YOUR_TURN_NOTE = 'shows as “your turn” for up to 5 minutes — a soft state, never an alert.';

const CLAUDE_AGENTS_HELP = `Live view of agents working right now: main sessions, their running subagents (Task/Agent spawns and Workflow agents), and recently finished ones — refreshed every few seconds from active session logs. A session whose turn just finished ${YOUR_TURN_NOTE} Empty when nothing is running.`;

const CODEX_AGENTS_HELP = `Live view of Codex threads working right now in the ChatGPT desktop app, with the subagents each turn spawns — Guardian auto-reviews and delegated agents — nested beneath, plus recently finished ones; refreshed every few seconds from the local rollout files. A thread whose turn just finished ${YOUR_TURN_NOTE} Empty when nothing is running.`;

const CLAUDE_AGENT_LABELS: AgentLabels = {
  mains: 'Main sessions',
  subagents: 'Subagents',
  otherSubagents: 'Other subagents',
  subagentUnit: ['subagent', 'subagents'],
  mainUnit: ['session', 'sessions'],
  empty: 'No agents running right now',
  waitingHelp:
    'A session paused on something only you can resolve: an unresolved tool call (likely a permission prompt), a tool call you rejected, or a turn that ended in an API error or usage limit. This is inferred — the logs have no explicit “waiting for confirmation” marker — so it may occasionally over- or under-count.',
  yourTurnHelp:
    'Sessions whose last turn finished normally: the agent is idle, ready for your next prompt. Listed for up to 5 minutes; never red, never an alert.',
};

const CODEX_AGENT_LABELS: AgentLabels = {
  mains: 'Codex threads',
  subagents: 'Subagents',
  otherSubagents: 'Other subagents',
  subagentUnit: ['subagent', 'subagents'],
  mainUnit: ['thread', 'threads'],
  empty: 'No Codex threads running right now',
  waitingHelp:
    'A thread paused on something only you can resolve: an approval request (a tool call with no result yet under the “on-request” approval policy, reviewed by you rather than the Guardian), an action you declined, or a turn that failed (e.g. at the usage limit). This is inferred — rollouts have no explicit “awaiting approval” record — so it may occasionally over- or under-count.',
  yourTurnHelp:
    'Threads whose last turn finished normally: Codex is idle, ready for your next prompt. Listed for up to 5 minutes; never red, never an alert.',
};

// The subagents endpoint clamps days to 1–90.
export const AGENT_HISTORY_DAYS = 30;

function historyUnit(platform: AgentPlatform): 'session' | 'thread' {
  return platform === 'codex' ? 'thread' : 'session';
}

// What a "spawn" is differs per platform; the stats do not.
function historyHelp(platform: AgentPlatform, days: number): string {
  const what =
    platform === 'codex'
      ? `Subagent threads Codex spawned over the last ${days} days — one Guardian auto-review per approval verdict, plus delegated agents`
      : `Subagents Claude Code spawned (Agent/Task calls) over the last ${days} days`;
  const unit = historyUnit(platform);
  return `${what}: how many, how many per ${unit} that delegated, the share of ${unit}s that delegated at all, and which types did the work.`;
}

export type MainAgentState = 'waiting' | 'delegating' | 'running' | 'yourTurn' | 'idle';
export type AgentCountTone = 'danger' | 'info' | 'neutral';

export interface AgentCountView {
  key: string;
  label: string;
  tone: AgentCountTone;
  live: boolean;
  help: string | null;
}

export interface RunningSubagentView {
  key: string;
  name: string;
  description: string;
  model: string;
  startedAt: number;
  effectiveTokens: number;
  traffic: AgentTrafficStatus;
}

export interface CompletedSubagentView {
  key: string;
  name: string;
  description: string;
  model: string;
  completedAt: number;
  tokens: string | null;
}

export interface MainAgentView {
  key: string;
  title: string;
  project: string;
  branch: string;
  model: string;
  lastActivity: number;
  effectiveTokens: number;
  state: MainAgentState;
  running: RunningSubagentView[];
  completed: CompletedSubagentView[];
}

export interface AgentActivityView {
  platform: AgentPlatform;
  title: string;
  help: string;
  counts: AgentCountView[];
  state: SectionState | null;
  mainsLabel: string;
  subagentsLabel: string;
  orphansLabel: string;
  mains: MainAgentView[];
  orphanRunning: RunningSubagentView[];
  orphanCompleted: CompletedSubagentView[];
}

export interface AgentActivityInput {
  platform: AgentPlatform;
  scope: Platform;
  data: LiveAgentsData | null;
  loading: boolean;
  error: string | null;
}

export interface AgentHistoryStatView {
  key: string;
  label: string;
  value: string;
  sub: string;
}

export interface AgentHistoryTypeView {
  type: string;
  label: string;
  count: string;
  percent: number;
}

export interface AgentHistoryView {
  platform: AgentPlatform;
  title: string;
  description: string;
  help: string;
  stacked: boolean;
  state: SectionState | null;
  stats: AgentHistoryStatView[];
  types: AgentHistoryTypeView[];
  moreTypes: string | null;
}

export interface AgentHistoryInput {
  platform: AgentPlatform;
  scope: Platform;
  data: SubagentStats | null;
  loading: boolean;
  error: string | null;
}

export const AGENTS_PAGE_DESCRIPTION: Record<Platform, string> = {
  claude: `Sessions and subagents working right now, and how much you delegated in the last ${AGENT_HISTORY_DAYS} days.`,
  codex: `Threads and subagents working right now, and how much Codex delegated in the last ${AGENT_HISTORY_DAYS} days.`,
  both: `Sessions, threads and subagents working right now, and how much each platform delegated in the last ${AGENT_HISTORY_DAYS} days.`,
};

const LIVE_AGENTS_TITLE = 'Live agents';
const HISTORY_TITLE = 'Subagents spawned';
const HISTORY_TYPE_LIMIT = 4;
const SERVER_DOWN = 'The dashboard server did not answer. It keeps retrying.';

const LOAD_ERROR: Record<AgentPlatform, string> = {
  claude: 'Could not load live agents',
  codex: 'Could not load Codex threads',
};

const EMPTY_HINT: Record<AgentPlatform, string> = {
  claude: 'Start a session in Claude Code and it shows up here within a few seconds.',
  codex: 'Run a thread in the ChatGPT desktop app and it shows up here within a few seconds.',
};

const HISTORY_EMPTY_HINT: Record<AgentPlatform, string> = {
  claude: 'Subagents show up here once a Claude Code session delegates work with the Agent tool.',
  codex: 'Subagents show up here once a Codex thread spawns an auto-review or a delegated agent.',
};

// Claude types are the Agent tool's subagent_type (already readable); Codex kinds come from session_meta.source and read better spelled out.
const SUBAGENT_TYPE_LABELS: Record<string, string> = {
  guardian_review: 'Guardian review',
  guardian: 'Guardian review',
  review: 'Code review',
  thread_spawn: 'Spawned agent',
  'workflow-subagent': 'Workflow agent',
  'general-purpose': 'General purpose',
};

function scopeSuffix(platform: AgentPlatform, scope: Platform): string {
  return scope === 'both' ? ` · ${PLATFORM_NOUN[platform]}` : titleScope(scope);
}

function plural(count: number, units: readonly [string, string]): string {
  return count === 1 ? units[0] : units[1];
}

function mainState(main: LiveMainAgent): MainAgentState {
  if (main.traffic === 'waiting') return 'waiting';
  if (main.delegating) return 'delegating';
  if (main.active) return 'running';
  return isYourTurn(main) ? 'yourTurn' : 'idle';
}

function runningView(agent: LiveSubagent): RunningSubagentView {
  return {
    key: agent.key,
    name: agent.name || 'agent',
    description: agent.description,
    model: agent.model,
    startedAt: agent.startedAt,
    effectiveTokens: agent.effectiveTokens,
    traffic: agent.traffic,
  };
}

function completedView(agent: RecentlyCompletedSubagent): CompletedSubagentView {
  const tokens = agent.effectiveTokens ?? 0;
  return {
    key: agent.key,
    name: agent.name || 'agent',
    description: agent.description,
    model: agent.model,
    completedAt: agent.completedAt,
    tokens: tokens > 0 ? `${compact(tokens)} tok` : null,
  };
}

export function buildAgentActivity({ platform, scope, data, loading, error }: AgentActivityInput): AgentActivityView {
  const labels = platform === 'codex' ? CODEX_AGENT_LABELS : CLAUDE_AGENT_LABELS;
  const running = data?.running ?? [];
  const completed = data?.recentlyCompleted ?? [];
  const mains = data?.mainAgents ?? [];
  const mainKeys = new Set(mains.map((main) => main.key));

  const waiting = data?.counts.waiting ?? 0;
  const yourTurn = mains.filter(isYourTurn).length;
  const activeMains = mains.filter((main) => main.active || main.delegating).length;
  const counts: AgentCountView[] = [];
  if (waiting > 0) {
    counts.push({ key: 'waiting', label: `${waiting} waiting on you`, tone: 'danger', live: false, help: labels.waitingHelp });
  }
  if (yourTurn > 0) {
    counts.push({ key: 'yourTurn', label: `${yourTurn} your turn`, tone: 'info', live: false, help: labels.yourTurnHelp });
  }
  if (running.length > 0) {
    counts.push({
      key: 'subagents',
      label: `${running.length} ${plural(running.length, labels.subagentUnit)} running`,
      tone: 'neutral',
      live: true,
      help: null,
    });
  }
  if (activeMains > 0) {
    counts.push({
      key: 'mains',
      label: `${activeMains} ${plural(activeMains, labels.mainUnit)} active`,
      tone: 'neutral',
      live: false,
      help: null,
    });
  }

  const hasActivity = running.length > 0 || completed.length > 0 || mains.length > 0;
  let state: SectionState | null = null;
  if (!data && loading) state = { kind: 'loading', skeleton: 'text', rows: 3 };
  else if (!data && error) state = { kind: 'error', title: LOAD_ERROR[platform], description: SERVER_DOWN };
  else if (!hasActivity) state = { kind: 'empty', icon: 'bot', title: labels.empty, description: EMPTY_HINT[platform] };

  return {
    platform,
    title: `${LIVE_AGENTS_TITLE}${scopeSuffix(platform, scope)}`,
    help: platform === 'codex' ? CODEX_AGENTS_HELP : CLAUDE_AGENTS_HELP,
    counts,
    state,
    mainsLabel: labels.mains,
    subagentsLabel: labels.subagents,
    orphansLabel: mains.length > 0 ? labels.otherSubagents : labels.subagents,
    mains: mains.map((main) => ({
      key: main.key,
      title: main.title || 'Untitled',
      project: main.project,
      branch: main.gitBranch,
      model: main.model,
      lastActivity: main.lastActivity,
      effectiveTokens: main.effectiveTokens,
      state: mainState(main),
      running: running.filter((agent) => agent.parentKey === main.key).map(runningView),
      completed: completed.filter((agent) => agent.parentKey === main.key).map(completedView),
    })),
    orphanRunning: running.filter((agent) => !mainKeys.has(agent.parentKey)).map(runningView),
    orphanCompleted: completed.filter((agent) => !mainKeys.has(agent.parentKey)).map(completedView),
  };
}

function subagentTypeLabel(type: string): string {
  return SUBAGENT_TYPE_LABELS[type] ?? type;
}

function topTypes(byType: Record<string, number>, limit: number): { rows: AgentHistoryTypeView[]; rest: number } {
  const entries = Object.entries(byType).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const rows = entries.slice(0, limit).map(([type, count]) => ({
    type,
    label: subagentTypeLabel(type),
    count: compact(count),
    percent: total > 0 ? (count / total) * 100 : 0,
  }));
  return { rows, rest: Math.max(0, entries.length - limit) };
}

export function buildAgentHistory({ platform, scope, data, loading, error }: AgentHistoryInput): AgentHistoryView {
  const days = AGENT_HISTORY_DAYS;
  const unit = historyUnit(platform);
  const { rows, rest } = topTypes(data?.byType ?? {}, HISTORY_TYPE_LIMIT);

  let state: SectionState | null = null;
  if (!data && (loading || !error)) state = { kind: 'loading', skeleton: 'bars', rows: 3 };
  else if (!data) state = { kind: 'error', title: 'Could not load subagent history', description: SERVER_DOWN };
  else if (data.spawns === 0) {
    state = {
      kind: 'empty',
      icon: 'bot',
      title: `No subagents spawned in the last ${days} days`,
      description: HISTORY_EMPTY_HINT[platform],
    };
  }

  return {
    platform,
    title: `${HISTORY_TITLE}${scopeSuffix(platform, scope)}`,
    description: `Last ${days} days`,
    help: historyHelp(platform, days),
    stacked: scope === 'both',
    state,
    stats: data
      ? [
          { key: 'spawns', label: 'Spawns', value: compact(data.spawns), sub: `Last ${days} days` },
          { key: 'average', label: `Avg per ${unit}`, value: data.avgPerSession.toFixed(1), sub: `In ${unit}s that delegated` },
          { key: 'rate', label: 'Delegation rate', value: `${Math.round(data.delegationRate * 100)}%`, sub: `Of all ${unit}s` },
        ]
      : [],
    types: rows,
    moreTypes: rest > 0 ? `${rest} more ${rest === 1 ? 'type' : 'types'}` : null,
  };
}
