import { toDisplayAgents, type LiveAgentsData } from '@/lib/agents';
import { buildAgentActivity, buildAgentHistory } from '@/lib/views/agents';
import { agentDetailKey, buildWorkflowStats, type WorkflowAgentDetailState } from '@/lib/views/workflows';
import type { SubagentStats, WorkflowAgentDetail, WorkflowAgentInfo, WorkflowRun, WorkflowStats, WorkflowsData } from '@/types';

const NOW = Date.now();
const MINUTE = 60_000;
const DAY = 86_400_000;
const PROJECT = 'C:\\dev\\my-gym';
const PROMPT_LABEL =
  'You are a documentation researcher. Use ToolSearch to load the context7 doc tools, then read the Next.js PWA docs and report every breaking change';
const SERVER_ERROR = 'Error: HTTP 500';

const LIVE_AGENTS: LiveAgentsData = {
  running: [
    {
      key: 'sub-review',
      parentKey: 'main-delegating',
      name: 'code-reviewer',
      description: 'Review the diff for regressions and verify every finding against the source before reporting it',
      model: 'claude-sonnet-5-5',
      startedAt: NOW - 4 * MINUTE,
      lastActivity: NOW,
      effectiveTokens: 120_000,
      project: PROJECT,
      status: 'running',
      traffic: 'running',
    },
    {
      key: 'sub-explore',
      parentKey: 'main-delegating',
      name: 'Explore',
      description: 'Find importers',
      model: 'claude-haiku-5',
      startedAt: NOW - 20_000,
      lastActivity: NOW,
      effectiveTokens: 0,
      project: PROJECT,
      status: 'running',
      traffic: 'running',
    },
    {
      key: 'orphan-workflow',
      parentKey: 'not-listed',
      name: 'workflow-subagent',
      description: 'Its parent session is no longer listed',
      model: 'inherit',
      startedAt: NOW - 61 * MINUTE,
      lastActivity: NOW,
      effectiveTokens: 9500,
      project: PROJECT,
      status: 'running',
      traffic: 'running',
    },
  ],
  recentlyCompleted: [
    {
      key: 'done-explore',
      parentKey: 'main-delegating',
      name: 'Explore',
      description: 'Find every importer of the old organisms and list them',
      model: 'claude-haiku-5',
      completedAt: NOW - 90_000,
      background: false,
      effectiveTokens: 45_000,
      project: PROJECT,
    },
    {
      key: 'done-plan',
      parentKey: 'not-listed',
      name: 'Plan',
      description: '',
      model: '',
      completedAt: NOW - 3 * MINUTE,
      background: true,
      effectiveTokens: 0,
      project: PROJECT,
    },
  ],
  mainAgents: [
    {
      key: 'main-delegating',
      title: 'Rebuild the agents page on the new design system and keep every existing behaviour',
      project: PROJECT,
      gitBranch: 'redesign/v2',
      model: 'claude-opus-5-5',
      startedAt: NOW - 60 * MINUTE,
      lastActivity: NOW - 2000,
      effectiveTokens: 2_300_000,
      active: true,
      delegating: true,
      status: 'running',
      traffic: 'running',
    },
    {
      key: 'main-waiting',
      title: 'Needs a permission',
      project: PROJECT,
      gitBranch: '',
      model: 'claude-opus-5-5',
      startedAt: NOW - 10 * MINUTE,
      lastActivity: NOW - MINUTE,
      effectiveTokens: 10_000,
      active: false,
      delegating: false,
      status: 'running',
      traffic: 'waiting',
    },
    {
      key: 'main-your-turn',
      title: 'Finished its turn',
      project: PROJECT,
      gitBranch: 'main',
      model: 'claude-sonnet-5-5',
      startedAt: NOW - 10 * MINUTE,
      lastActivity: NOW - 2 * MINUTE,
      effectiveTokens: 5000,
      active: false,
      delegating: false,
      status: 'running',
      traffic: 'finished',
      yourTurn: true,
    },
    {
      key: 'main-idle',
      title: '',
      project: '',
      gitBranch: '',
      model: '',
      startedAt: NOW - 10 * MINUTE,
      lastActivity: NOW - 5 * MINUTE,
      effectiveTokens: 0,
      active: false,
      delegating: false,
      status: 'running',
      traffic: 'finished',
    },
    {
      key: 'main-running',
      title: 'Plain active',
      project: PROJECT,
      gitBranch: 'fix/row-widths',
      model: 'gpt-5.6-terra',
      startedAt: NOW - 10 * MINUTE,
      lastActivity: NOW - 1000,
      effectiveTokens: 900,
      active: true,
      delegating: false,
      status: 'running',
      traffic: 'running',
    },
  ],
  counts: { running: 5, waiting: 1, finished: 2, yourTurn: 1 },
};

const NO_AGENTS: LiveAgentsData = { running: [], recentlyCompleted: [], mainAgents: [], counts: { running: 0, waiting: 0, finished: 0 } };

const SUBAGENT_STATS: SubagentStats = {
  spawns: 412,
  byType: { 'general-purpose': 200, Explore: 120, 'workflow-subagent': 60, guardian_review: 20, Plan: 10, 'code-reviewer': 2 },
  byModel: {},
  avgPerSession: 3.24,
  delegationRate: 0.412,
  delegation: { spawns: 392, sessions: 121, rate: 0.41, avgPerSession: 3.2 },
  autoReview: { reviews: 20, denials: 1, sessions: 6, rate: 0.02, avgPerSession: 3.3 },
};

export const ACTIVITY_VIEWS = [
  buildAgentActivity({ platform: 'claude', scope: 'claude', data: toDisplayAgents(LIVE_AGENTS), loading: false, error: null }),
  buildAgentActivity({ platform: 'claude', scope: 'both', data: null, loading: true, error: null }),
  buildAgentActivity({ platform: 'codex', scope: 'both', data: null, loading: false, error: SERVER_ERROR }),
  buildAgentActivity({ platform: 'codex', scope: 'codex', data: NO_AGENTS, loading: false, error: null }),
];

export const HISTORY_WIDE_VIEW = buildAgentHistory({ platform: 'claude', scope: 'claude', data: SUBAGENT_STATS, loading: false, error: null });

export const HISTORY_VIEWS = [
  buildAgentHistory({ platform: 'claude', scope: 'both', data: SUBAGENT_STATS, loading: false, error: null }),
  buildAgentHistory({ platform: 'codex', scope: 'both', data: { ...SUBAGENT_STATS, spawns: 0, byType: {} }, loading: false, error: null }),
  buildAgentHistory({ platform: 'claude', scope: 'both', data: null, loading: true, error: null }),
  buildAgentHistory({ platform: 'codex', scope: 'both', data: null, loading: false, error: SERVER_ERROR }),
];

const WORKFLOW_STATS: WorkflowStats = {
  totalRuns: 69,
  completed: 67,
  failed: 2,
  successRate: 0.971,
  totalTokens: 103_000_000,
  totalAgents: 631,
  avgDurationMs: 76 * MINUTE,
  topModel: 'claude-opus-5-5',
  estCostUsd: 1332,
  totalToolCalls: 33_000,
  busiestDay: { day: NOW - 12 * DAY, count: 10 },
  topRunsByCost: [],
  recentRuns: [],
};

export const STATS_VIEWS = [
  buildWorkflowStats({ stats: WORKFLOW_STATS, loading: false, error: null }),
  buildWorkflowStats({ stats: null, loading: true, error: null }),
  buildWorkflowStats({ stats: null, loading: false, error: SERVER_ERROR }),
];

function agent(agentId: string, phaseTitle: string, state: WorkflowAgentInfo['state'], over: Partial<WorkflowAgentInfo> = {}): WorkflowAgentInfo {
  return {
    agentId,
    label: PROMPT_LABEL,
    phaseTitle,
    agentType: 'general-purpose',
    model: 'claude-sonnet-5-5',
    state,
    tokens: 235_000,
    toolCalls: 56,
    durationMs: 266_000,
    startedAt: NOW - 266_000,
    index: 1,
    attempt: 1,
    queuedMs: 6700,
    ...over,
  };
}

function run(runId: string, over: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    runId,
    name: 'gym-app-design',
    summary: 'Research current stack docs, then design schema and RLS, sync contract and frontend architecture, synthesize and critique',
    status: 'completed',
    isLive: false,
    startedAt: NOW - 921_000,
    durationMs: 921_000,
    lastActivity: NOW - MINUTE,
    phaseDone: 3,
    phaseTotal: 4,
    phases: [
      { title: 'Research', detail: '' },
      { title: 'Design', detail: '' },
      { title: 'Synthesize', detail: '' },
      { title: 'Critique', detail: '' },
    ],
    agents: [],
    agentCount: 9,
    runningAgents: 0,
    tokens: 1_300_000,
    cost: 10.67,
    costBasis: 'per-agent',
    toolCalls: 182,
    defaultModel: 'claude-opus-5-5',
    project: 'my-gym',
    ...over,
  };
}

const LIVE_RUN_AGENTS: WorkflowAgentInfo[] = [
  agent('research-1', 'Research', 'done'),
  agent('research-2', 'Research', 'done', { attempt: 3, tokens: 12_345_678, toolCalls: 1234, durationMs: 45_296_000, model: 'claude-opus-5-5' }),
  agent('research-3', 'Research', 'error', { attempt: 2, toolCalls: 999, durationMs: 3_599_000, model: 'gpt-5.6-terra', agentType: 'code-reviewer' }),
  agent('research-4', 'Research', 'done', { label: 'short label', model: 'inherit', agentType: '' }),
  agent('design-1', 'Design', 'done'),
  agent('design-2', 'Design', 'done'),
  agent('critique-1', 'Critique', 'running', { tokens: 1_234_567, toolCalls: 1234, startedAt: NOW - 12 * MINUTE, durationMs: 0, attempt: 2 }),
  agent('critique-2', 'Critique', 'queued', { tokens: 0, toolCalls: 0, durationMs: 0 }),
  agent('critique-3', 'Critique', 'stalled', { tokens: 50_000, toolCalls: 3, durationMs: 0, attempt: 3 }),
];

export const SPECIMEN_WORKFLOWS: WorkflowsData = {
  live: [run('live', { status: 'running', isLive: true, agents: LIVE_RUN_AGENTS, agentCount: 10, runningAgents: 1 })],
  recent: [
    run('completed', {
      agents: LIVE_RUN_AGENTS.map((item) => ({ ...item, state: item.state === 'running' || item.state === 'queued' ? 'done' : item.state })),
      resultStats: { sourcesFetched: 12, after_synthesis: 'ok' },
      logsTail: ['[phase] Research done in 4m 26s', '[phase] Critique done in 2m 0s'],
    }),
    run('failed', {
      name: 'meta-pixel-audit-fix',
      status: 'failed',
      startedAt: NOW - 3 * DAY,
      lastActivity: NOW - 3 * DAY,
      defaultModel: 'inherit',
      cost: 0,
      summary: '',
      agents: [agent('failed-1', 'Research', 'error')],
      logsTail: ['Error: agent failed-1 stopped'],
    }),
    run('bare', {
      name: 'weekly-ai-news',
      status: 'unknown',
      startedAt: NOW - 40 * DAY,
      lastActivity: NOW - 40 * DAY,
      costBasis: 'blended-run',
      phaseTotal: null,
      toolCalls: 0,
      project: '',
    }),
  ],
};

const READY_DETAIL: WorkflowAgentDetail = {
  agentId: 'research-1',
  agentType: 'general-purpose',
  label: PROMPT_LABEL,
  phaseTitle: 'Research',
  index: 1,
  attempt: 2,
  state: 'done',
  prompt: `${PROMPT_LABEL}.\nReturn a short list, one finding per line.`,
  resultSummary: 'Found 12 breaking changes. The service worker registration moved, and the manifest route needs a new export.',
  resultFiles: ['C:\\dev\\my-gym\\docs\\research\\nextjs-pwa.md', 'C:\\dev\\my-gym\\docs\\research\\manifest.md'],
  tools: [
    { name: 'mcp__context7__query-docs', count: 31, failed: 0 },
    { name: 'WebFetch', count: 14, failed: 2 },
    { name: 'Read', count: 8, failed: 0 },
    { name: 'ToolSearch', count: 3, failed: 0 },
  ],
  toolFailures: 2,
  turns: 41,
  tokens: { input: 18_000, output: 22_000, cacheCreate: 195_000, cacheRead: 2_100_000 },
  models: ['claude-sonnet-5-5'],
  skills: ['docs'],
  mcpServers: ['context7'],
  queuedMs: 6700,
  startedAt: NOW - 266_000,
  durationMs: 266_000,
};

const DETAIL_BY_AGENT: Record<string, WorkflowAgentDetailState> = {
  'research-2': { data: null, loading: true, error: null },
  'research-3': { data: null, loading: false, error: SERVER_ERROR },
};

export const SPECIMEN_DETAILS: ReadonlyMap<string, WorkflowAgentDetailState> = new Map(
  [...SPECIMEN_WORKFLOWS.live, ...SPECIMEN_WORKFLOWS.recent].flatMap((item) =>
    item.agents.map((member): [string, WorkflowAgentDetailState] => [
      agentDetailKey(item.runId, member.agentId),
      DETAIL_BY_AGENT[member.agentId] ?? { data: { ...READY_DETAIL, agentId: member.agentId }, loading: false, error: null },
    ]),
  ),
);

export const INITIAL_PINNED: ReadonlyMap<string, number> = new Map([['live', 0]]);
export const INITIAL_OPEN_RUNS: ReadonlySet<string> = new Set(['completed']);
export const INITIAL_OPEN_AGENTS: ReadonlySet<string> = new Set(
  ['research-1', 'research-2', 'research-3'].map((agentId) => agentDetailKey('live', agentId)),
);
