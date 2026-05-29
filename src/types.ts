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
