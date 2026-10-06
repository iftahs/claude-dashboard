import type { RankedMeterRow } from '@/components/design-system/molecules/RankedMeterList/types';
import { modelColor } from '@/lib/palette';
import type { Platform } from '@/lib/platform';
import type { SectionAi } from '@/lib/section';
import {
  buildBranches,
  buildCommandUsage,
  buildComplexity,
  buildErrorBreakdown,
  buildFileChurn,
  buildInsightKpis,
  buildLanguages,
  buildMcpBreakdown,
  buildRejections,
  buildRetries,
  buildSubagentStats,
  buildToolUsage,
  buildTurnLatency,
  buildYield,
  type InsightDays,
  type InsightKpisView,
  type InsightPoll,
} from '@/lib/views/insights';
import {
  DEFAULT_TOKEN_INPUTS,
  PRICING_DATA,
  buildCostCalculation,
  buildEffortBreakdown,
  buildModelBreakdown,
  isHeadlinePrice,
  priceGroups,
  selectedPrice,
  type CostCalculationView,
  type ExpandedGroups,
  type PricePlatform,
  type TokenInputs,
} from '@/lib/views/models';
import type {
  CommandUsageData,
  ComplexityPoint,
  EffortData,
  EffortSlice,
  FileChurnData,
  InsightKpis,
  InsightsBranches,
  InsightsErrors,
  InsightsLanguages,
  InsightsMcp,
  InsightsRejections,
  InsightsRetries,
  InsightsSummary,
  InsightsTurns,
  InsightsYield,
  LatencyStats,
  ModelsData,
  ReasoningShare,
  SubagentStats,
  ToolsData,
} from '@/types';

const DAY = 86_400_000;
const NOW = Date.now();
const DAYS: InsightDays = '7';
const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-4-5';
const TERRA = 'gpt-5.6-terra';
const ASTRA = 'gpt-6-astra';
const GUARDIAN = 'codex-auto-review';
const LONG_TOOL = 'mcp__chrome-devtools__performance_analyze_insight';

export const IDLE_AI: SectionAi = { onAsk: () => undefined };
export const TOKEN_DEFAULTS: TokenInputs = DEFAULT_TOKEN_INPUTS;

function ok<T>(data: T): InsightPoll<T> {
  return { data, loading: false, error: null };
}

function pending<T>(): InsightPoll<T> {
  return { data: null, loading: true, error: null };
}

function failed<T>(): InsightPoll<T> {
  return { data: null, loading: false, error: 'TypeError: Failed to fetch' };
}

function ymd(daysAgo: number): string {
  return new Date(NOW - daysAgo * DAY).toISOString().slice(0, 10);
}

function scope(platform: Platform) {
  return { platform, days: DAYS, ai: IDLE_AI };
}

const CLAUDE_KPIS: InsightKpis = {
  totalCalls: 14_120,
  failures: 248,
  failureRate: 0.0176,
  rejections: 12,
  rejectionRate: 0.0008,
  sessions: 23,
  repoSessions: 22,
  committed: 10,
  commitRate: 0.45,
  delegatingSessions: 6,
  delegationSpawns: 70,
  delegationRate: 0.26,
  codexSessions: 0,
  reviews: 0,
  denials: 0,
  reviewedSessions: 0,
  autoReviewRate: null,
};
const CODEX_KPIS: InsightKpis = {
  totalCalls: 326,
  failures: 16,
  failureRate: 0.049,
  rejections: 1,
  rejectionRate: 0.003,
  sessions: 6,
  repoSessions: 0,
  committed: 0,
  commitRate: null,
  delegatingSessions: 0,
  delegationSpawns: 0,
  delegationRate: null,
  codexSessions: 6,
  reviews: 65,
  denials: 1,
  reviewedSessions: 4,
  autoReviewRate: 0.67,
};
const BOTH_KPIS: InsightKpis = { ...CLAUDE_KPIS, totalCalls: 14_446, failures: 264, failureRate: 0.0183, rejections: 13, autoReviewRate: 0.67 };

const SUMMARY: Record<Platform, InsightsSummary> = {
  claude: { ...CLAUDE_KPIS, byPlatform: { claude: CLAUDE_KPIS, codex: null } },
  codex: { ...CODEX_KPIS, byPlatform: { claude: null, codex: CODEX_KPIS } },
  both: { ...BOTH_KPIS, byPlatform: { claude: CLAUDE_KPIS, codex: CODEX_KPIS } },
};

export const KPI_VIEWS: readonly InsightKpisView[] = [
  buildInsightKpis(ok(SUMMARY.claude), 'claude'),
  buildInsightKpis(ok(SUMMARY.codex), 'codex'),
  buildInsightKpis(ok(SUMMARY.both), 'both'),
  buildInsightKpis(pending(), 'claude'),
  buildInsightKpis(failed(), 'claude'),
];

const ERRORS: InsightsErrors = {
  totalCalls: 14_446,
  errors: 264,
  errorRate: 0.0183,
  rejections: 13,
  rejectionRate: 0.0009,
  categories: { 'exit-code': 137, 'mcp-error': 47, other: 21, blocked: 15, 'file-not-found': 14, timeout: 13, 'not-read': 12, 'edit-mismatch': 5 },
  perTool: [
    { name: 'Bash', calls: 6600, errors: 147, errorRate: 0.022 },
    { name: 'PowerShell', calls: 290, errors: 30, errorRate: 0.103 },
    { name: LONG_TOOL, calls: 534, errors: 23, errorRate: 0.043 },
    { name: 'Write', calls: 1900, errors: 9, errorRate: 0.005 },
    { name: 'mcp__claude_ai_Notion__notion-fetch', calls: 9, errors: 7, errorRate: 0.78 },
    { name: 'Edit', calls: 1100, errors: 7, errorRate: 0.006 },
  ],
  perToolTotal: 24,
  trend: [78, 16, 22, 48, 12, 4, 64, 30].map((errors, index, all) => ({ date: ymd(all.length - 1 - index), calls: 1500 + index * 90, errors })),
};

export const ERROR_VIEWS = {
  ready: buildErrorBreakdown({ poll: ok(ERRORS), ...scope('both') }),
  states: [
    buildErrorBreakdown({ poll: pending(), ...scope('claude') }),
    buildErrorBreakdown({ poll: failed(), ...scope('claude') }),
    buildErrorBreakdown({ poll: ok({ ...ERRORS, errors: 0 }), ...scope('claude') }),
  ],
};

const REJECTIONS: InsightsRejections = {
  total: 13,
  guardianDenials: 2,
  userDeclines: 11,
  perTool: [
    { name: 'Bash', calls: 6600, rejections: 6 },
    { name: 'AskUserQuestion', calls: 28, rejections: 3 },
    { name: 'GuardianReview', calls: 2, rejections: 2 },
    { name: LONG_TOOL, calls: 534, rejections: 2 },
  ],
};

export const REJECTION_VIEWS = [
  buildRejections({ poll: ok({ ...REJECTIONS, guardianDenials: 0, perTool: REJECTIONS.perTool.filter((tool) => tool.name !== 'GuardianReview') }), ...scope('claude') }),
  buildRejections({ poll: ok(REJECTIONS), ...scope('both') }),
  buildRejections({ poll: ok({ total: 0, guardianDenials: 0, userDeclines: 0, perTool: [] }), ...scope('codex') }),
];

const RETRIES: InsightsRetries = { oneShotRate: 0.995, totalEdits: 3000, retried: 14, wastedTokens: 151_000, wastedCost: 1.34, codexEdits: 15 };

export const RETRY_VIEWS = [
  buildRetries({ poll: ok(RETRIES), ...scope('both') }),
  buildRetries({ poll: ok(RETRIES), ...scope('codex') }),
  buildRetries({ poll: ok({ ...RETRIES, oneShotRate: null, totalEdits: 0 }), ...scope('claude') }),
  buildRetries({ poll: pending(), ...scope('claude') }),
];

const TOOLS: ToolsData = {
  rangeFrom: NOW - 7 * DAY,
  rangeTo: NOW,
  totalCalls: 14_446,
  tools: [
    ['Bash', 6600],
    ['Read', 2300],
    ['Write', 1900],
    ['Edit', 1100],
    [LONG_TOOL, 534],
    ['PowerShell', 290],
    ['Grep', 275],
    ['WebFetch', 223],
    ['mcp__codex_apps__google_drive.get_spreadsheet_range', 186],
    ['Glob', 92],
    ['Agent', 70],
    ['ToolSearch', 55],
  ].map(([name, count]) => ({ name: String(name), count: Number(count) })),
};

export const TOOL_VIEWS = {
  ready: buildToolUsage({ poll: ok(TOOLS), ...scope('both') }),
  states: [
    buildToolUsage({ poll: pending(), ...scope('claude') }),
    buildToolUsage({ poll: failed(), ...scope('claude') }),
    buildToolUsage({ poll: ok({ ...TOOLS, totalCalls: 0, tools: [] }), ...scope('claude') }),
  ],
};

const MCP: InsightsMcp = {
  builtinCalls: 13_400,
  mcpCalls: 1046,
  perServer: [
    { server: 'chrome-devtools', calls: 720, errors: 23 },
    { server: 'claude_ai_Notion', calls: 240, errors: 7 },
    { server: 'context7', calls: 86, errors: 0 },
  ],
};

export const MCP_VIEWS = [
  buildMcpBreakdown({ poll: ok(MCP), ...scope('claude') }),
  buildMcpBreakdown({ poll: ok({ builtinCalls: 326, mcpCalls: 0, perServer: [] }), ...scope('codex') }),
  buildMcpBreakdown({ poll: failed(), ...scope('both') }),
];

const COMMANDS: CommandUsageData = {
  totalCommands: 31,
  uniqueCommands: 7,
  slashCommands: 19,
  skillSessions: 12,
  commands: [
    { command: '/compact', count: 9, kind: 'slash' },
    { command: 'atomic-design', count: 6, kind: 'skill' },
    { command: '/model', count: 5, kind: 'slash' },
    { command: 'a-skill-with-a-very-long-name-that-has-to-truncate', count: 4, kind: 'skill' },
    { command: '/login', count: 3, kind: 'slash' },
    { command: 'grill-me', count: 2, kind: 'skill' },
    { command: '/reload-plugins', count: 2, kind: 'slash' },
  ],
};

export const COMMAND_VIEWS = [
  buildCommandUsage({ poll: ok(COMMANDS), ...scope('claude') }),
  buildCommandUsage({ poll: ok({ ...COMMANDS, commands: [] }), ...scope('codex') }),
];

const SUBAGENTS: SubagentStats = {
  spawns: 135,
  byType: { guardian_review: 65, 'general-purpose': 63, Explore: 3, unknown: 3, Plan: 1 },
  byModel: { [GUARDIAN]: 65, opus: 59, sonnet: 11 },
  avgPerSession: 11.7,
  delegationRate: 0.31,
  delegation: { spawns: 70, sessions: 6, rate: 0.26, avgPerSession: 11.7 },
  autoReview: { reviews: 65, denials: 1, sessions: 4, rate: 0.67, avgPerSession: 16.3 },
};
const NO_SUBAGENTS: SubagentStats = {
  spawns: 0,
  byType: {},
  byModel: {},
  avgPerSession: 0,
  delegationRate: 0,
  delegation: { spawns: 0, sessions: 0, rate: null, avgPerSession: 0 },
  autoReview: { reviews: 0, denials: 0, sessions: 0, rate: null, avgPerSession: 0 },
};

export const SUBAGENT_VIEWS = [
  buildSubagentStats({ poll: ok(SUBAGENTS), ...scope('both') }),
  buildSubagentStats({ poll: ok(SUBAGENTS), ...scope('codex') }),
  buildSubagentStats({ poll: ok(NO_SUBAGENTS), ...scope('claude') }),
];

const LANGUAGES: InsightsLanguages[] = [
  { language: 'TypeScript', edits: 2100, reads: 824 },
  { language: 'Markdown', edits: 456, reads: 309 },
  { language: 'C#', edits: 161, reads: 36 },
  { language: 'JSON', edits: 98, reads: 63 },
  { language: 'Python', edits: 41, reads: 0 },
  { language: 'Other', edits: 25, reads: 922 },
];

export const LANGUAGE_VIEWS = [
  buildLanguages({ poll: ok(LANGUAGES), ...scope('claude') }),
  buildLanguages({ poll: ok([]), ...scope('claude') }),
];

const BRANCHES: InsightsBranches[] = [
  { repo: 'claude-dashboard', branch: 'redesign/v2', effectiveTokens: 98_000_000, cost: 604, sessions: 9 },
  { repo: 'billing-service', branch: 'main', effectiveTokens: 36_000_000, cost: 196, sessions: 4 },
  { repo: 'landing-pages', branch: 'fix/campaign-bot-click-filtering-and-a-much-longer-branch-name', effectiveTokens: 1_600_000, cost: 9.01, sessions: 1 },
  { repo: 'scratch', branch: 'HEAD', effectiveTokens: 198_000, cost: 0, sessions: 1 },
];

export const BRANCH_VIEWS = [
  buildBranches({ poll: ok(BRANCHES), ...scope('both') }),
  buildBranches({ poll: ok([]), ...scope('codex') }),
];

const YIELD: InsightsYield = {
  sessions: 29,
  repoSessions: 22,
  noRepo: 7,
  tokensNoRepo: 3_000_000,
  committed: 10,
  tokensCommitted: 228_000_000,
  uncommitted: 12,
  tokensUncommitted: 397_000,
  rate: 0.45,
  prSessions: 5,
  prCount: 7,
  prOnlySessions: 2,
  topUncommitted: [
    { project: 'claude-custom-plugins', date: ymd(1), effectiveTokens: 131_000 },
    { project: 'a-project-with-a-very-long-folder-name-that-has-to-truncate', date: ymd(1), effectiveTokens: 96_000 },
    { project: 'take-by-take', date: ymd(6), effectiveTokens: 57_000 },
  ],
};

export const YIELD_VIEWS = [
  buildYield({ poll: ok(YIELD), ...scope('both') }),
  buildYield({ poll: ok({ ...YIELD, sessions: 0 }), ...scope('claude') }),
];

const CHURN: FileChurnData = {
  totalEdits: 3000,
  uniqueFiles: 2021,
  files: [
    ['routes.tsx', 'claude-dashboard', 55],
    ['DevicesViewModel.cs', 'windows-manager', 18],
    ['TRAINING_APP_IMPLEMENTATION_PLAN_FINAL_v2.md', 'new-chat', 14],
    ['state.ts', 'my-gym', 14],
    ['README.md', '', 11],
    ['prompter.ts', 'take-by-take', 9],
  ].map(([name, projectName, edits]) => ({
    path: `C:\\dev\\${projectName || 'scratch'}\\src\\${name}`,
    name: String(name),
    projectName: String(projectName),
    edits: Number(edits),
    lastTs: NOW,
  })),
};

export const CHURN_VIEWS = [
  buildFileChurn({ poll: ok(CHURN), ...scope('both') }),
  buildFileChurn({ poll: failed(), ...scope('claude') }),
];

const POINTS: ComplexityPoint[] = [
  [18_671, 98_000_000, 14, 'claude'],
  [9372, 62_000_000, 42, 'claude'],
  [5480, 36_000_000, 21, 'claude'],
  [3010, 17_000_000, 12, 'claude'],
  [760, 2_900_000, 4, 'claude'],
  [420, 1_700_000, 0, 'claude'],
  [180, 352_000, 0, 'claude'],
  [117, 1_200_000, 17, 'codex'],
  [92, 600_000, 25, 'codex'],
  [68, 310_000, 12, 'codex'],
  [8, 20_000, 0, 'codex'],
].map(([toolCalls, effectiveTokens, subagents, platform], index) => ({
  sessionId: `sample-${index}`,
  project: platform === 'codex' ? `thread-${index}` : `project-${index}`,
  turns: Number(toolCalls) + 40,
  toolCalls: Number(toolCalls),
  subagents: Number(subagents),
  effectiveTokens: Number(effectiveTokens),
  durationMin: 30 + index * 12,
  date: ymd(index % 7),
  platform: platform === 'codex' ? 'codex' : 'claude',
}));

export const COMPLEXITY_VIEWS = {
  both: buildComplexity({ poll: ok(POINTS), ...scope('both') }),
  codex: buildComplexity({ poll: ok(POINTS.filter((point) => point.platform === 'codex')), ...scope('codex') }),
  states: [buildComplexity({ poll: pending(), ...scope('claude') }), buildComplexity({ poll: ok([]), ...scope('claude') })],
};

const CLAUDE_LATENCY: LatencyStats = { turns: 156, medianMs: 55_000, p90Ms: 485_000, medianTtftMs: 4700, p90TtftMs: 17_000, activeMs: 27_400_000 };
const CODEX_LATENCY: LatencyStats = { turns: 26, medianMs: 130_000, p90Ms: 574_000, medianTtftMs: 3100, p90TtftMs: 8500, activeMs: 6_100_000 };
const BUCKETS: [string, number, number][] = [
  ['<10s', 30, 0],
  ['10–30s', 27, 5],
  ['30s–1m', 24, 1],
  ['1–2m', 24, 6],
  ['2–5m', 28, 6],
  ['5–10m', 13, 6],
  ['10–30m', 8, 2],
  ['30m+', 2, 0],
];

function turns(claude: boolean, codex: boolean): InsightsTurns {
  const stats = claude && codex ? { ...CLAUDE_LATENCY, turns: 182, activeMs: 33_500_000 } : claude ? CLAUDE_LATENCY : CODEX_LATENCY;
  return {
    ...stats,
    histogram: BUCKETS.map(([label, c, x]) => {
      const claudeCount = claude ? c : 0;
      const codexCount = codex ? x : 0;
      return { label, upToMs: null, claude: claudeCount, codex: codexCount, total: claudeCount + codexCount };
    }),
    byPlatform: { claude: claude ? CLAUDE_LATENCY : null, codex: codex ? CODEX_LATENCY : null },
  };
}

export const LATENCY_VIEWS = {
  claude: buildTurnLatency({ poll: ok(turns(true, false)), ...scope('claude') }),
  both: buildTurnLatency({ poll: ok(turns(true, true)), ...scope('both') }),
  states: [buildTurnLatency({ poll: pending(), ...scope('claude') }), buildTurnLatency({ poll: failed(), ...scope('claude') })],
};

function totals(effectiveTokens: number, cost: number) {
  return {
    inputTokens: effectiveTokens * 0.2,
    outputTokens: effectiveTokens * 0.3,
    cacheCreateTokens: effectiveTokens * 0.5,
    cacheReadTokens: effectiveTokens * 9,
    totalTokens: effectiveTokens * 10,
    effectiveTokens,
    cost,
  };
}

const MODELS: ModelsData = {
  rangeFrom: NOW - 7 * DAY,
  rangeTo: NOW,
  models: [
    { model: OPUS, ...totals(83_000_000, 1116) },
    { model: SONNET, ...totals(3_000_000, 18.1) },
    { model: ASTRA, ...totals(507_000, 13.9) },
    { model: GUARDIAN, ...totals(374_000, 0) },
    { model: TERRA, ...totals(237_000, 1.43) },
    { model: HAIKU, ...totals(5900, 0.02) },
  ],
};

export const MODEL_VIEWS = [
  buildModelBreakdown({ poll: ok(MODELS), platform: 'both', ai: IDLE_AI }),
  buildModelBreakdown({ poll: ok({ ...MODELS, models: [] }), platform: 'claude', ai: IDLE_AI }),
  buildModelBreakdown({ poll: pending(), platform: 'claude', ai: IDLE_AI }),
];

function reasoning(share: number | null, coverage: number): ReasoningShare {
  return { outputTokens: 1_000_000, reportedOutputTokens: 1_000_000 * coverage, reasoningTokens: 1_000_000 * coverage * (share ?? 0), share, coverage };
}

function slices(parts: [string, number, number][]): EffortSlice[] {
  return parts.map(([effort, effectiveTokens, cost]) => ({ effort, effectiveTokens, cost, messages: Math.round(effectiveTokens / 4000) }));
}

const EFFORT: EffortData = {
  rangeFrom: NOW - 7 * DAY,
  rangeTo: NOW,
  efforts: slices([
    ['none', 2_000_000, 0],
    ['minimal', 4_000_000, 12],
    ['low', 9_000_000, 41],
    ['medium', 14_000_000, 96],
    ['high', 21_000_000, 240],
    ['xhigh', 30_000_000, 520],
    ['max', 6_000_000, 180],
    ['unknown', 3_000_000, 27],
  ]),
  models: [
    {
      model: OPUS,
      effectiveTokens: 57_000_000,
      cost: 940,
      reasoning: reasoning(0.48, 1),
      efforts: slices([
        ['high', 21_000_000, 240],
        ['xhigh', 30_000_000, 520],
        ['max', 6_000_000, 180],
      ]),
    },
    {
      model: SONNET,
      effectiveTokens: 26_000_000,
      cost: 164,
      reasoning: reasoning(0.41, 0.62),
      efforts: slices([
        ['low', 9_000_000, 41],
        ['medium', 14_000_000, 96],
        ['unknown', 3_000_000, 27],
      ]),
    },
    {
      model: GUARDIAN,
      effectiveTokens: 6_000_000,
      cost: 0,
      reasoning: reasoning(null, 0),
      efforts: slices([
        ['none', 2_000_000, 0],
        ['minimal', 4_000_000, 0],
      ]),
    },
  ],
  reasoning: reasoning(0.46, 0.9),
};

export const EFFORT_VIEWS = [
  buildEffortBreakdown({ poll: ok(EFFORT), platform: 'both' }),
  buildEffortBreakdown({ poll: ok({ ...EFFORT, models: [] }), platform: 'claude' }),
  buildEffortBreakdown({ poll: failed(), platform: 'claude' }),
];

export function pricingView(platform: Platform, selectedName: string | null, expanded: ExpandedGroups, inputs: TokenInputs): CostCalculationView {
  const groups = priceGroups(platform);
  return buildCostCalculation({ platform, groups, selected: selectedPrice(groups, selectedName), expanded, inputs });
}

export function groupToExpand(name: string): PricePlatform | null {
  const model = PRICING_DATA.find((entry) => entry.name === name);
  return model && !isHeadlinePrice(model) ? model.platform : null;
}

export const PLAIN_ROWS: readonly RankedMeterRow[] = [
  { label: 'Bash', percent: 100, value: '6.6K' },
  { label: 'Read', percent: 35, value: '2.3K' },
  { label: 'chrome-devtools · performance_analyze_insight', percent: 8, value: '534' },
  { label: 'Glob', percent: 1, value: '92' },
];

export const TONED_ROWS: readonly RankedMeterRow[] = [
  { label: 'Bash', percent: 100, value: '147 / 6.6K', valueTone: 'muted', secondary: '2%', secondaryTone: 'muted' },
  { label: 'PowerShell', percent: 20, value: '30 / 290', valueTone: 'muted', secondary: '10%', secondaryTone: 'warning' },
  { label: 'Notion · notion-fetch', percent: 5, value: '7 / 9', valueTone: 'muted', secondary: '78%', secondaryTone: 'danger' },
];

export const SWATCH_ROWS: readonly RankedMeterRow[] = [
  { label: 'sonnet 5.5', color: modelColor(SONNET), percent: 22, value: '~$5.99 / 1M' },
  { label: 'opus 5.5', color: modelColor(OPUS), percent: 49, value: '~$13.47 / 1M' },
  { label: 'gpt-6-astra', color: modelColor(ASTRA), percent: 100, value: '~$27.41 / 1M' },
];

export const DETAIL_ROWS: readonly RankedMeterRow[] = [
  { key: 'skill:atomic-design', label: 'atomic-design', badge: 'skill', percent: 100, value: '6' },
  { key: 'slash:/compact', label: '/compact', percent: 66, value: '4' },
  { key: 'file', label: 'routes.tsx', detail: 'claude-dashboard', title: 'C:\\dev\\claude-dashboard\\src\\routes.tsx', percent: 33, value: '2' },
];
