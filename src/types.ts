export interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  effectiveTokens: number;
  cost: number;
}

export type UsageSource = 'code' | 'cowork';

/** Effective-token totals split by surface (Code vs Cowork). */
export interface SourceSplit {
  code: TokenTotals;
  cowork: TokenTotals;
}

/** /api/sources — which usage surfaces have local data. Gates all Cowork UI. */
export interface SourcesInfo {
  code: { events: number; lastTs: number };
  cowork: { available: boolean; events: number; lastTs: number };
}

export interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  isDocker: boolean;
  repoUrl: string;
  changelogUrl: string;
}

export interface Bucket extends TokenTotals {
  start: number;
  byModel: Record<string, number>;
  byModelCost: Record<string, number>;
}

export interface ModelShare extends TokenTotals {
  model: string;
}

export interface ActiveBlock {
  start: number;
  resetsAt: number;
  isActive: boolean;
  totals: TokenTotals;
  prevTotals: TokenTotals;
  byModel: Record<string, number>;
}

export interface RecentData {
  rangeFrom: number;
  rangeTo: number;
  buckets: Bucket[];
  totals: TokenTotals;
  byModel: ModelShare[];
  bySource?: SourceSplit;
  activeBlock: ActiveBlock;
}

export interface WeeklyData {
  rangeFrom: number;
  rangeTo: number;
  weeklyResetsAt: number;
  buckets: Bucket[];
  totals: TokenTotals;
  prevTotals: TokenTotals;
  byModel: ModelShare[];
  bySource?: SourceSplit;
  cacheEfficiency?: { date: string; hitRate: number; cacheReadTokens: number; totalTokens: number }[];
}

export interface ModelsData {
  rangeFrom: number;
  rangeTo: number;
  models: ModelShare[];
}

export interface DailyActivity {
  date: string;
  effectiveTokens: number;
  messageCount: number;
  toolCallCount: number;
}

export interface ActivityData {
  rangeFrom: number;
  rangeTo: number;
  dailyActivity: DailyActivity[];
}

export interface ToolShare {
  name: string;
  count: number;
}

export interface ToolsData {
  rangeFrom: number;
  rangeTo: number;
  totalCalls: number;
  tools: ToolShare[];
}

export interface Envelope<T> {
  data: T;
  computedAt: number;
  claudeDir: string;
}

/** Actual billed cost pulled from a LiteLLM gateway (mirrors server LiteLlmSpend). */
export interface LiteLlmSpend {
  monthLabel: string;
  monthToDate: number;
  monthRequests: number;
  prevMonthLabel: string;
  prevMonthToDate: number;
  daily: { date: string; cost: number; requests: number; byModel: Record<string, number> }[];
}
export type LiteLlmSpendData = LiteLlmSpend | { error: string };

export interface ClaudeConfig {
  effortLevel?: string;
  model?: string;
  voiceEnabled?: boolean;
  remoteControlAtStartup?: boolean;
  inputNeededNotifEnabled?: boolean;
  agentPushNotifEnabled?: boolean;
  autoUpdatesChannel?: string;
  subscriptionType?: string | null;
  rateLimitTier?: string | null;
  authMode?: 'api' | 'subscription';
  litellm?: { available: boolean; gatewayHost: string };
  enabledPlugins?: Record<string, boolean>;
  extraKnownMarketplaces?: Record<string, unknown>;
  permissions?: {
    allow?: string[];
    deny?: string[];
    ask?: string[];
    defaultMode?: string;
    additionalDirectories?: string[];
  };
}

export interface SessionMeta {
  session_id: string;
  source?: UsageSource;
  project_path: string;
  start_time: string;
  duration_minutes: number;
  user_message_count: number;
  assistant_message_count: number;
  tool_counts: Record<string, number>;
  languages: Record<string, number>;
  git_commits: number;
  git_pushes: number;
  input_tokens: number;
  output_tokens: number;
  cache_create_tokens?: number;
  cache_read_tokens?: number;
  effective_tokens?: number;
  total_tokens?: number;
  first_prompt: string;
  user_interruption_count?: number;
  tool_errors?: number;
  lines_added?: number;
  lines_removed?: number;
  files_modified?: number;
}

export interface LiveLimitInfo {
  utilization: number;
  resets_at: string;
}

export interface LiveUsageData {
  five_hour: LiveLimitInfo;
  seven_day: LiveLimitInfo;
  seven_day_oauth_apps?: LiveLimitInfo | null;
  seven_day_opus?: LiveLimitInfo | null;
  seven_day_sonnet?: LiveLimitInfo | null;
  seven_day_cowork?: LiveLimitInfo | null;
  seven_day_omelette?: LiveLimitInfo | null;
  error?: string;
}

export interface HeatmapData {
  /** 7 rows (Mon=0 … Sun=6) × 24 cols (hour 0 … 23), values = effective tokens */
  grid: number[][];
  rangeFrom: number;
  rangeTo: number;
}

export interface ProjectStat {
  path: string;
  name: string;
  effectiveTokens: number;
  cost: number;
  sessionCount: number;
}

export interface ProjectData {
  rangeFrom: number;
  rangeTo: number;
  projects: ProjectStat[];
}

// ---------------------------------------------------------------------------
// Insights types
// ---------------------------------------------------------------------------

export interface InsightsErrors {
  totalCalls: number;
  errors: number;
  errorRate: number;
  categories: Record<string, number>;
  perTool: { name: string; calls: number; errors: number; errorRate: number }[];
  trend: { date: string; calls: number; errors: number }[];
}

export interface InsightsRetries {
  oneShotRate: number;
  totalEdits: number;
  retried: number;
  wastedTokens: number;
  wastedCost: number;
}

export interface InsightsLanguages {
  language: string;
  edits: number;
  reads: number;
}

export interface InsightsBranches {
  branch: string;
  repo: string;
  effectiveTokens: number;
  cost: number;
  sessions: number;
}

export interface InsightsMcp {
  builtinCalls: number;
  mcpCalls: number;
  perServer: { server: string; calls: number; errors: number }[];
}

export interface ComplexityPoint {
  sessionId: string;
  project: string;
  turns: number;
  toolCalls: number;
  subagents: number;
  effectiveTokens: number;
  durationMin: number;
  date: string;
}

export interface InsightsYield {
  committed: number;
  tokensCommitted: number;
  uncommitted: number;
  tokensUncommitted: number;
  rate: number;
  topUncommitted: { project: string; date: string; effectiveTokens: number }[];
}

export interface InsightsRejections {
  total: number;
  perTool: { name: string; calls: number; rejections: number }[];
}

export interface SubagentStats {
  spawns: number;
  byType: Record<string, number>;
  byModel: Record<string, number>;
  avgPerSession: number;
  delegationRate: number;
}

export interface LiveSubagent {
  key: string;
  parentKey: string;
  name: string;
  description: string;
  model: string;
  startedAt: number;
  lastActivity: number;
  effectiveTokens: number;
  project: string;
  status: 'running';
}

export interface RecentlyCompletedSubagent {
  key: string;
  parentKey: string;
  name: string;
  description: string;
  model: string;
  completedAt: number;
  background: boolean;
  effectiveTokens: number;
  project: string;
}

export interface MainAgent {
  key: string;
  title: string;
  project: string;
  gitBranch: string;
  model: string;
  startedAt: number;
  lastActivity: number;
  effectiveTokens: number;
  active: boolean;
  delegating: boolean;
  status: 'running';
}

export interface LiveSubagents {
  running: LiveSubagent[];
  recentlyCompleted: RecentlyCompletedSubagent[];
  mainAgents: MainAgent[];
}

// ── Dynamic workflows ────────────────────────────────────────────────────────

export type WorkflowAgentState = 'done' | 'running' | 'queued' | 'error' | 'stalled';

export interface WorkflowAgentInfo {
  agentId: string;
  label: string;
  phaseTitle: string;
  model: string;
  state: WorkflowAgentState;
  tokens: number;
  toolCalls: number;
  durationMs: number;
  startedAt: number;
  lastToolName?: string;
}

export interface WorkflowRun {
  runId: string;
  name: string;
  summary: string;
  status: 'running' | 'completed' | 'failed' | 'unknown';
  isLive: boolean;
  startedAt: number;
  durationMs: number;
  lastActivity: number;
  phaseDone: number | null;
  phaseTotal: number | null;
  phases: { title: string; detail: string }[];
  agents: WorkflowAgentInfo[];
  agentCount: number;
  runningAgents: number;
  tokens: number;
  toolCalls: number;
  defaultModel: string;
  project: string;
  resultStats?: Record<string, number | string>;
  logsTail?: string[];
}

export interface WorkflowsData {
  live: WorkflowRun[];
  recent: WorkflowRun[];
}

// ── AI Insights ──────────────────────────────────────────────────────────────

export type AiProvider = 'claude' | 'openai' | 'gemini';
export type AiBackend = 'cli' | 'api' | 'apikey' | 'claude' | 'openai' | 'gemini' | 'none';

export interface AiConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

export interface AiStatus {
  available: AiBackend;
  model: string;
  reason?: string;
}

export interface AiChatResponse {
  answer: string;
  backend: AiBackend;
}

export interface AiInsightResponse {
  insight: string;
  backend: AiBackend;
}

// ── Workspace & extra insights panels ────────────────────────────────────────

export interface CommandUsageData {
  totalCommands: number;
  uniqueCommands: number;
  commands: { command: string; count: number }[];
}

export interface FileChurnEntry {
  path: string;
  name: string;
  edits: number;
  projectName: string;
  lastTs: number;
}

export interface FileChurnData {
  totalEdits: number;
  uniqueFiles: number;
  files: FileChurnEntry[];
}

export interface TaskItem {
  id: string;
  subject: string;
  status: string;
  blocked: boolean;
}

export interface PlanItem {
  name: string;
  title: string;
  sizeBytes: number;
  ageDays: number;
}

export interface WorkspaceTasksData {
  tasks: { total: number; byStatus: Record<string, number>; completionRate: number; items: TaskItem[] };
  plans: { total: number; items: PlanItem[] };
}

export interface InventoryData {
  plugins: { name: string; marketplace: string; version: string; installedAt?: string }[];
  marketplaces: string[];
  enabledPlugins: string[];
  mcpServers: { name: string; scope: 'global' | 'project' }[];
  hooks: string[];
  model?: string;
  effortLevel?: string;
}

export interface SessionTranscriptTurn {
  role: 'user' | 'assistant';
  ts: number;
  text: string;
  tools: { name: string; brief: string }[];
  model?: string;
  effectiveTokens?: number;
}

export interface SessionTranscript {
  sessionId: string;
  turns: SessionTranscriptTurn[];
  compactions: number;
  totalTurns: number;
  truncated?: boolean;
}

export interface SearchResult {
  sessionId: string;
  project: string;
  date: string;
  snippet: string;
  matches: number;
}

