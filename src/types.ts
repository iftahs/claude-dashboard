export interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  effectiveTokens: number;
  cost: number;
}

export type UsageSource = 'code' | 'cowork' | 'codex';

/** Effective-token totals split by surface (Code / Cowork / Codex). */
export interface SourceSplit {
  code: TokenTotals;
  cowork: TokenTotals;
  codex: TokenTotals;
}

/**
 * /api/sources — which usage surfaces have local data (lifetime event counts) and
 * where each platform's data is read from. Gates all Cowork and Codex UI, the
 * empty state and a Codex-only user's default platform. The dirs are optional:
 * an older backend omits them, and the sidebar falls back to the envelope's claudeDir.
 */
export interface SourcesInfo {
  code: { events: number; lastTs: number };
  cowork: { available: boolean; events: number; lastTs: number };
  /** `dir` (the Codex data dir) is optional: older backends do not send it. */
  codex: { available: boolean; events: number; lastTs: number; dir?: string };
  /** Claude Code's data folder (~/.claude, or /data/.claude in Docker). */
  claudeDir?: string;
  /** Codex's home (~/.codex, or /data/.codex in Docker). */
  codexDir?: string;
  /** The Cowork desktop root; null when this OS has no default and COWORK_DIR is unset. */
  coworkDir?: string | null;
}

/** One Codex rate-limit window, normalised from either the live `/wham/usage`
 *  payload or the passive `token_count.rate_limits` snapshot in a rollout. */
export interface CodexWindow {
  usedPct: number;          // 0–100
  windowSec: number;        // 18000 (5-hour) or 604800 (weekly)
  resetsAt: string | null;  // ISO; null when the window has lapsed / is unknown
}

/** GET /api/codex/live — the ChatGPT desktop (Codex) plan limits. PII stripped. */
export interface CodexLiveData {
  planType: string | null;              // 'plus' | 'go' | 'pro' | 'team' | …
  fiveHour: CodexWindow | null;
  weekly: CodexWindow | null;
  limitReached: boolean;
  credits: { hasCredits: boolean; unlimited: boolean; balance: string | null; overageLimitReached: boolean } | null;
  resetCredits: { available: number; applicable: number } | null;
  modelAvailability: Record<string, boolean>;
  origin: 'live' | 'passive';           // network fetch vs newest rollout snapshot
  snapshotAt: string | null;            // passive only: timestamp of the snapshot record
  warning?: string;                     // passive only: why live failed — non-fatal, the data still renders
  error?: string;                       // nothing usable (auth problem, no snapshot)
}

/** GET /api/codex/profile — server-side stats from `/wham/profiles/me` (stats only, no profile). */
export interface CodexProfileStats {
  lifetimeTokens: number;
  peakDailyTokens: number;
  currentStreakDays: number;
  longestStreakDays: number;
  totalThreads: number;
  longestRunningTurnSec: number;
  mostUsedReasoningEffort: string | null;
  mostUsedReasoningEffortPct: number | null;
  dailyUsage: { date: string; tokens: number }[]; // UTC days, ascending
  error?: string;
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
  /** Total tokens per model, cache reads included (tooltips only). */
  byModel: Record<string, number>;
  /** Effective tokens per model — what the token bar charts stack. */
  byModelEffective: Record<string, number>;
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

/**
 * GET /api/codex/block — the Codex counterpart of `RecentData.activeBlock`: local
 * Codex usage inside the current rate-limit window (the 5-hour one, else weekly).
 */
export interface CodexBlock extends ActiveBlock {
  windowSec: number;
  /** 'live'/'passive': the provider's window (reset − length); 'local': rolled from the first Codex event. */
  anchor: 'live' | 'passive' | 'local';
  /** Codex is signed in with an OpenAI API key (pay-as-you-go, no plan windows). */
  apiKey?: boolean;
}

/** A stretch of refused requests at one usage limit — see server/aggregate.ts buildLimitHits. */
export interface LimitHitEpisode {
  start: number;
  last: number;
  resetsAt: number | null;
  kind: 'session' | 'weekly' | 'model' | 'unknown';
  source: UsageSource;
  model: string;
  requests: number;
}

/** GET /api/insights/limits?days=&source= */
export interface LimitHitsData {
  rangeFrom: number;
  rangeTo: number;
  episodes7d: number;
  episodes30d: number;
  requests7d: number;
  requests30d: number;
  active: LimitHitEpisode | null;
  episodes: LimitHitEpisode[];
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
  /** Codex usage split by thread kind — the Sources card under the Codex platform. */
  codexSplit?: CodexSplit;
  cacheEfficiency?: { date: string; hitRate: number; cacheReadTokens: number; totalTokens: number }[];
  /** Earliest event in the scoped history (null when there is none). */
  firstEventTs?: number | null;
}

export interface ModelsData {
  rangeFrom: number;
  rangeTo: number;
  models: ModelShare[];
}

/** Codex usage split into user threads vs guardian auto-reviews (mirrors server CodexSplit). */
export interface CodexSplit {
  threads: TokenTotals;
  guardian: TokenTotals;
}

/** GET /api/usage/effort — one effort level's share (mirrors server EffortSlice). */
export interface EffortSlice {
  /** 'low' | 'medium' | 'high' | 'xhigh' | 'max' | … ; 'unknown' when the log has none. */
  effort: string;
  effectiveTokens: number;
  cost: number;
  messages: number;
}

/** Reasoning (thinking) share of output over the responses that report the split. */
export interface ReasoningShare {
  outputTokens: number;
  reportedOutputTokens: number;
  reasoningTokens: number;
  /** null = nothing in the window reports it (show n/a, never 0%). */
  share: number | null;
  /** Fraction of the window's output tokens `share` is computed over. */
  coverage: number;
}

export interface ModelEffort {
  model: string;
  effectiveTokens: number;
  cost: number;
  efforts: EffortSlice[];
  reasoning: ReasoningShare;
}

/** GET /api/usage/effort?days=&source= — Models "Reasoning effort" card. */
export interface EffortData {
  rangeFrom: number;
  rangeTo: number;
  efforts: EffortSlice[];
  models: ModelEffort[];
  reasoning: ReasoningShare;
}

/** Lifetime figures over every event of the scoped history (mirrors server UsageSummary). */
export interface UsageSummary {
  firstEventTs: number | null;
  lastEventTs: number | null;
  lifetimeEffectiveTokens: number;
  lifetimeTotalTokens: number;
  lifetimeCost: number;
  /** Local calendar day with the most effective tokens. */
  peakDay: { date: string; effectiveTokens: number } | null;
  currentStreakDays: number;
  longestStreakDays: number;
  activeDays: number;
  /** Local calendar days from the first event's day through today. */
  spanDays: number;
}

/** GET /api/usage/summary?source= — the unscoped (Both) response adds the per-platform split. */
export interface UsageSummaryData extends UsageSummary {
  byPlatform?: { claude: UsageSummary; codex: UsageSummary };
}

export interface DailyActivity {
  /** YYYY-MM-DD — the local calendar day, or the UTC day for `?utc=1`. */
  date: string;
  effectiveTokens: number;
  /** Every token, cache reads included (the server always sends it; optional so
   *  client-side placeholder days need not invent one). */
  totalTokens?: number;
  messageCount: number;
  toolCallCount: number;
}

export interface ActivityData {
  rangeFrom: number;
  rangeTo: number;
  /** True for `?utc=1`: days are UTC days (no stats-cache fallback). */
  utc?: boolean;
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
  monthSuccessful: number;
  monthFailed: number;
  monthTokens: { prompt: number; completion: number; cacheRead: number; cacheCreate: number };
  prevMonthLabel: string;
  prevMonthToDate: number;
  lifetime: { user: number; key: number };
  daily: { date: string; cost: number; requests: number; successful: number; byModel: Record<string, number> }[];
  /** Gateway had more spend rows than the page cap fetched — figures may undercount. */
  truncated?: boolean;
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
  seatTier?: string | null;
  hasExtraUsageEnabled?: boolean;
  authMode?: 'api' | 'subscription';
  litellm?: { available: boolean; gatewayHost: string };
  enabledPlugins?: Record<string, boolean>;
  extraKnownMarketplaces?: Record<string, unknown>;
  permissions?: {
    allow?: string[];
    defaultMode?: string;
    additionalDirectories?: string[];
  };
}

export interface SessionMeta {
  session_id: string;
  source?: UsageSource;
  project_path: string;
  /** Claude's custom / AI title, or the Codex thread name (session_index.jsonl). */
  title?: string;
  start_time: string;
  /** Wall clock, first → last record — idle time included. */
  duration_minutes: number;
  /** Sum of recorded turn durations; null when no turn was recorded. */
  active_ms?: number | null;
  /** User turns that got an answer (Claude prompt → reply, Codex task_complete) — same on both platforms. */
  turn_count?: number;
  /** Pull requests the session opened or linked. */
  pr_urls?: string[];
  /** Client that wrote the session (Claude entrypoint / Codex originator) and its version. */
  client?: string;
  client_version?: string;
  /** Every user line for Claude (tool results included) — prefer turn_count. */
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

/**
 * One entry in Anthropic's newer `limits` array — the model-scoped source that
 * replaced the top-level `seven_day_<model>` keys. `kind` is 'session' |
 * 'weekly_all' | 'weekly_scoped'; scoped weekly windows (e.g. Fable) carry the
 * model in `scope.model.display_name`.
 */
export interface LiveLimit {
  kind: string;
  group: string; // 'session' | 'weekly'
  percent: number;
  severity: string;
  resets_at: string | null;
  scope: { model?: { id: string | null; display_name: string | null } | null; surface?: string | null } | null;
  is_active: boolean;
}

/** Org-level "extra usage" credits — billed at standard API rates once a seat's
 *  included plan usage runs out (Team/Enterprise pre-purchased pool, or a
 *  personal Pro/Max self-serve toggle). Null/absent on older API responses. */
export interface LiveExtraUsage {
  is_enabled: boolean;
  monthly_limit: number | null;
  used_credits: number | null;
  utilization: number | null;
  currency: string;
  decimal_places: number;
  disabled_reason: string | null;
  /** The user switched extra usage off themselves (vs. the org never enabling it). */
  user_disabled?: boolean | null;
  credits_ever_enabled?: boolean | null;
  daily: unknown | null;
  weekly: unknown | null;
}

/**
 * Each Claude surface's share of this week's usage so far (the rows add up to 100):
 * Claude Code, Chats, Cowork, Other. Not a share of the quota.
 */
export interface LiveWeeklyBreakdown {
  as_of: string | null;
  window_started_at: string | null;
  rows: { key: string; display_name: string | null; percent: number }[];
}

/** Current spend against the extra-usage pool, in minor currency units
 *  (amount_minor / 10^exponent = actual amount). */
export interface LiveSpend {
  used: { amount_minor: number; currency: string; exponent: number };
  limit: number | null;
  percent: number;
  severity: string;
  enabled: boolean;
  disabled_reason: string | null;
  cap: number | null;
  balance: number | null;
  auto_reload: unknown | null;
  disclaimer: string | null;
  can_purchase_credits: boolean;
  can_toggle: boolean;
}

export interface LiveUsageData {
  five_hour: LiveLimitInfo;
  seven_day: LiveLimitInfo;
  seven_day_oauth_apps?: LiveLimitInfo | null;
  seven_day_opus?: LiveLimitInfo | null;
  seven_day_sonnet?: LiveLimitInfo | null;
  seven_day_cowork?: LiveLimitInfo | null;
  seven_day_omelette?: LiveLimitInfo | null;
  limits?: LiveLimit[] | null;
  extra_usage?: LiveExtraUsage | null;
  spend?: LiveSpend | null;
  seven_day_breakdown?: LiveWeeklyBreakdown | null;
  error?: string;
}

/** One logged-in account's live plan/limits, from GET /api/accounts/live. Claude
 *  Code shares one credential slot, so these are snapshotted per account as each
 *  becomes active; an idle account's token expires within hours (`expired`). */
export interface AccountLive {
  key: string;                       // organizationUuid (or 'default')
  organizationUuid: string | null;
  email: string | null;             // from the live profile; null when unavailable
  label: string;                    // email, else "<plan> · <key prefix>"
  subscriptionType: string | null;
  rateLimitTier: string | null;
  live: LiveUsageData;              // per-account usage, or { error } (incl. stale)
  expired: boolean;                 // token past its expiresAt — data is a marker
  isActive: boolean;                // the account currently in the shared slot
  capturedAt: number;
}

export interface AccountsLiveData {
  accounts: AccountLive[];
}

// "What's contributing to your limits usage?" — cost-weighted Day/Week breakdown.
export interface ContribBehavior {
  key: string; // 'long_context' | 'subagent_heavy' | … | 'mcp:<server>' | 'skill:<name>'
  headline: string;
  body: string;
  pct: number;
}
export interface ContribRow {
  name: string;
  pct: number;
}
export interface ContribWindow {
  totalCost: number;
  requestCount: number;
  sessionCount: number;
  behaviors: ContribBehavior[];
  subagents: ContribRow[];
  mcpServers: ContribRow[];
  skills: ContribRow[];
  plugins: ContribRow[];
}
export interface ContributorsData {
  day: ContribWindow;
  week: ContribWindow;
  /** What each pct is a share of: estimated cost (Claude) or effective tokens (Codex — Guardian reviews are $0). */
  weight?: 'cost' | 'effectiveTokens';
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
  /** Paths this project was filed under before paths came from the transcript cwd (tag-key migration). */
  legacyPaths?: string[];
}

/** One platform's slice of the Sessions StatCard row (/api/sessions/summary). */
export interface SessionSummaryPart {
  sessions: number;
  since: number | null;
  longestActiveMs: number;
  longestSessionId: string | null;
  longestLabel: string;
  medianTurnMs: number | null;
  turnCount: number;
  linesAdded: number;
  linesRemoved: number;
}

export interface SessionSummary {
  total: SessionSummaryPart;
  /** Claude Code + Cowork. */
  claude: SessionSummaryPart;
  codex: SessionSummaryPart;
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
  /** Failed calls — rejections are never counted as failures. */
  errors: number;
  errorRate: number;
  rejections: number;
  rejectionRate: number;
  /** Failure categories only (no 'rejected'). */
  categories: Record<string, number>;
  /** Tools that failed at least once, most failures first (clipped). */
  perTool: { name: string; calls: number; errors: number; errorRate: number }[];
  perToolTotal: number;
  trend: { date: string; calls: number; errors: number }[];
}

export interface InsightsRetries {
  oneShotRate: number;
  /** Claude Edit/Write/MultiEdit calls only. */
  totalEdits: number;
  retried: number;
  wastedTokens: number;
  wastedCost: number;
  /** Codex edits in the window, left out: a Codex patch never retries. */
  codexEdits: number;
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

export type InsightPlatform = 'claude' | 'codex';

export interface ComplexityPoint {
  sessionId: string;
  project: string;
  turns: number;
  toolCalls: number;
  /** Subagent spawns + Codex guardian reviews — the dot size. */
  subagents: number;
  effectiveTokens: number;
  durationMin: number;
  date: string;
  platform: InsightPlatform;
}

export interface InsightsYield {
  /** Every session in the window. */
  sessions: number;
  /** Sessions that could commit (a branch, a remote, or git activity). */
  repoSessions: number;
  noRepo: number;
  tokensNoRepo: number;
  committed: number;
  tokensCommitted: number;
  uncommitted: number;
  tokensUncommitted: number;
  /** committed / repoSessions. */
  rate: number;
  prSessions: number;
  prCount: number;
  topUncommitted: { project: string; date: string; effectiveTokens: number }[];
}

export interface InsightsRejections {
  total: number;
  /** Codex guardian denials (tool name `GuardianReview`). */
  guardianDenials: number;
  /** Declines a person made: Claude permission prompts, Codex items under the 'user' reviewer. */
  userDeclines: number;
  perTool: { name: string; calls: number; rejections: number }[];
}

export interface SubagentStats {
  spawns: number;
  byType: Record<string, number>;
  byModel: Record<string, number>;
  avgPerSession: number;
  /** Any spawn, guardian reviews included (legacy blend). */
  delegationRate: number;
  delegation: { spawns: number; sessions: number; rate: number | null; avgPerSession: number };
  autoReview: { reviews: number; denials: number; sessions: number; rate: number | null; avgPerSession: number };
}

/** /api/insights/turns — per-turn latency (mirrors server buildTurnLatency). */
export interface LatencyStats {
  turns: number;
  medianMs: number | null;
  p90Ms: number | null;
  medianTtftMs: number | null;
  p90TtftMs: number | null;
  activeMs: number;
}

export interface InsightsTurns extends LatencyStats {
  histogram: { label: string; upToMs: number | null; claude: number; codex: number; total: number }[];
  byPlatform: Record<InsightPlatform, LatencyStats | null>;
}

/** /api/insights/summary — the Insights KPI row (mirrors server InsightKpis). */
export interface InsightKpis {
  totalCalls: number;
  failures: number;
  failureRate: number | null;
  rejections: number;
  rejectionRate: number | null;
  sessions: number;
  repoSessions: number;
  committed: number;
  commitRate: number | null;
  delegatingSessions: number;
  delegationSpawns: number;
  delegationRate: number | null;
  codexSessions: number;
  reviews: number;
  denials: number;
  reviewedSessions: number;
  autoReviewRate: number | null;
}

export interface InsightsSummary extends InsightKpis {
  byPlatform: Record<InsightPlatform, InsightKpis | null>;
}

/** Traffic-light status: finished (green) · running (yellow) · waiting (red).
 *  'waiting' is inferred (no explicit "awaiting permission" marker in the logs). */
export type AgentTrafficStatus = 'finished' | 'running' | 'waiting';

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
  traffic: AgentTrafficStatus;
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
  traffic: AgentTrafficStatus;
  /**
   * The last turn finished and the session is idle on the user — a soft state,
   * never red and never an alert. Sent by both live agent endpoints
   * (/api/subagents/live, /api/codex/agents/live); optional so an older backend
   * still type-checks and simply never shows it.
   */
  yourTurn?: boolean;
}

export interface LiveSubagents {
  running: LiveSubagent[];
  recentlyCompleted: RecentlyCompletedSubagent[];
  mainAgents: MainAgent[];
  /** `yourTurn` counts mains idle on the user; absent from an older backend. */
  counts: { running: number; waiting: number; finished: number; yourTurn?: number };
}

// ── Dynamic workflows ────────────────────────────────────────────────────────

export type WorkflowAgentState = 'done' | 'running' | 'queued' | 'error' | 'stalled';

export interface WorkflowAgentInfo {
  agentId: string;
  label: string;
  phaseTitle: string;
  /** Subagent type the script asked for (`frontend-dev`, `code-reviewer`, …). */
  agentType: string;
  model: string;
  state: WorkflowAgentState;
  tokens: number;
  toolCalls: number;
  durationMs: number;
  startedAt: number;
  /** Spawn order within the run — rows are sorted by tokens, so this is the only trace of it. */
  index: number;
  attempt: number;
  /** How long the agent sat behind the concurrency cap before starting. */
  queuedMs: number;
  lastToolName?: string;
  lastToolSummary?: string;
}

/** Lazily fetched from `/api/workflows/:runId/agents/:agentId` when a row is expanded. */
export interface WorkflowAgentDetail {
  agentId: string;
  agentType: string;
  label: string;
  phaseTitle: string;
  index: number;
  attempt: number;
  state: WorkflowAgentState;
  prompt: string;
  resultSummary: string;
  resultFiles: string[];
  tools: { name: string; count: number; failed: number }[];
  toolFailures: number;
  turns: number;
  /** cacheRead is excluded from effective tokens — it doesn't count toward rate limits. */
  tokens: { input: number; output: number; cacheCreate: number; cacheRead: number };
  models: string[];
  skills: string[];
  mcpServers: string[];
  queuedMs: number;
  startedAt: number;
  durationMs: number;
}

/** How a run's cost was priced — `per-agent` is materially more accurate. */
export type WorkflowCostBasis = 'per-agent' | 'blended-run';

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
  cost: number; // estimated equivalent-API cost
  costBasis: WorkflowCostBasis;
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

/** Path-free row safe to hand to the UI or a model. */
export interface WorkflowRunSummary {
  name: string;
  project: string;
  status: 'completed' | 'failed' | 'unknown';
  tokens: number;
  cost: number;
  costBasis: WorkflowCostBasis;
  agentCount: number;
  toolCalls: number;
  durationMs: number;
  startedAt: number;
  defaultModel: string;
}

/** All-time aggregate over every final workflow journal on disk (`/api/workflows/stats`). */
export interface WorkflowStats {
  totalRuns: number;
  completed: number;
  failed: number;
  successRate: number; // 0..1
  totalTokens: number;
  totalAgents: number;
  avgDurationMs: number;
  topModel: string;
  estCostUsd: number; // rough blended equivalent-API estimate
  totalToolCalls: number;
  busiestDay: { day: number; count: number } | null; // day = local-midnight ms
  topRunsByCost: WorkflowRunSummary[]; // all-time, cost desc — `recent` only covers 90d/200 runs
  recentRuns: WorkflowRunSummary[]; // all-time, newest first — same rows, no full journal parse
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
  /** Slash-command invocations + skill sessions. */
  totalCommands: number;
  uniqueCommands: number;
  /** Slash commands count invocations; skills count the sessions that ran them. */
  commands: { command: string; count: number; kind: 'slash' | 'skill' }[];
  slashCommands: number;
  skillSessions: number;
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

/** A platform whose home folder the Workspace tab reads (~/.claude or ~/.codex). */
export type WorkspacePlatform = 'claude' | 'codex';

export interface PlanItem {
  name: string;
  title: string;
  sizeBytes: number;
  ageDays: number;
  /** Set only on a merged `?source=all` list, where both platforms' plans share one list. */
  platform?: WorkspacePlatform;
}

export interface WorkspaceTasksData {
  tasks: { total: number; byStatus: Record<string, number>; completionRate: number; items: TaskItem[] };
  plans: { total: number; items: PlanItem[] };
}

export interface InventoryData {
  plugins: {
    name: string;
    marketplace: string;
    version: string;
    installedAt?: string;
    /** Codex only: the `[plugins.*] enabled` flag. */
    enabled?: boolean;
    platform?: WorkspacePlatform;
  }[];
  marketplaces: string[];
  enabledPlugins: string[];
  /** `command` is the launch program's basename (Codex config.toml only). */
  mcpServers: { name: string; scope: 'global' | 'project'; command?: string; platform?: WorkspacePlatform }[];
  hooks: string[];
  model?: string;
  effortLevel?: string;
  /** User skills (<home>/skills/<name>/SKILL.md); `system` marks Codex's bundled ones. */
  skills?: { name: string; system?: boolean; platform?: WorkspacePlatform }[];
  /** Codex scheduled automations — name, human schedule, status. */
  automations?: { name: string; schedule: string; status: string; platform?: WorkspacePlatform }[];
}

/** GET /api/codex/config — allowlisted ~/.codex/config.toml keys + login mode + data dir. */
export interface CodexConfigData {
  /** config.toml exists and was readable. */
  available: boolean;
  model: string | null;
  reasoningEffort: string | null;
  approvalPolicy: string | null;
  sandboxMode: string | null;
  personality: string | null;
  serviceTier: string | null;
  /** A turn-complete notify program is configured. */
  notify: boolean;
  plugins: { name: string; marketplace: string; enabled: boolean }[];
  marketplaces: string[];
  mcpServers: { name: string; command: string | null }[];
  /** Trusted-project counts only (no paths). */
  projects: { trusted: number; untrusted: number; total: number };
  /** How Codex is signed in: a ChatGPT plan token, an OpenAI API key, or neither. */
  authMode: 'chatgpt' | 'apikey' | null;
  /** The Codex data dir the dashboard reads (e.g. ~/.codex, or /data/.codex in Docker). */
  dir: string;
}

/** GET /api/archive — the opt-in history archive (DASHBOARD_RETAIN_HISTORY=1). */
export interface ArchiveSummary {
  /** Retention is switched on for this server (the env opt-in). */
  enabled: boolean;
  /** Archived transcript files (their slim rows, kept after Claude Code deleted them). */
  files: number;
  /** Stored size of the archived rows, in bytes. */
  bytes: number;
  /** Oldest usage/session timestamp the archive holds (epoch ms); null when empty. */
  oldestTs: number | null;
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
  /** The transcript file is gone (Claude Code cleanup); `turns` is empty and `message` says why. */
  archived?: boolean;
  message?: string;
}

export interface SearchResult {
  sessionId: string;
  source?: UsageSource;
  /** Last path segment of the project. */
  project: string;
  projectPath?: string;
  title?: string;
  date: string;
  snippet: string;
  matches: number;
}

