export interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  effectiveTokens: number;
  cost: number;
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

export interface ClaudeConfig {
  effortLevel?: string;
  model?: string;
  voiceEnabled?: boolean;
  remoteControlAtStartup?: boolean;
  subscriptionType?: string | null;
  rateLimitTier?: string | null;
  permissions?: {
    allow?: string[];
    additionalDirectories?: string[];
  };
}

export interface SessionMeta {
  session_id: string;
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

