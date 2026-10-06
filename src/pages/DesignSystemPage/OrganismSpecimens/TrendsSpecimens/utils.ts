import { PLATFORM_COLORS } from '@/lib/chart-theme';
import {
  buildActivityHeatmap,
  buildActivitySummary,
  buildCacheEfficiency,
  buildCodexCompare,
  buildDailyTrend,
  buildLiteLlmBilled,
  buildPeakHours,
  buildPlatformCompare,
  buildSourcesSplit,
  buildSpendKpis,
  cacheSeriesFor,
  computeCodexSplit,
  computeSourceSplit,
  type ActivityHeatmapView,
  type ActivitySummaryView,
  type CacheEfficiencyView,
  type CodexCompareView,
  type CompareRowView,
  type DailyMetric,
  type DailyTrendView,
  type LiteLlmBilledView,
  type PeakHoursView,
  type PlatformCompareView,
  type SourcesSplitView,
  type SpendKpisView,
  type TrendsLegendItem,
} from '@/lib/views/trends';
import { localYmd, startOfDay } from '@/lib/week';
import type { Bucket, DailyActivity, LiteLlmSpend, TokenTotals, UsageSummary, UsageSummaryData, WeeklyData } from '@/types';

const NOW = Date.now();
const DAY = 86_400_000;
const DAYS = 30;
const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-4-5';
const GPT = 'gpt-5.6-terra';
const GUARDIAN = 'codex-auto-review';
const COST_PER_MILLION = 14;
const ZERO: TokenTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreateTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 0,
  effectiveTokens: 0,
  cost: 0,
};

const TODAY = new Date(NOW);
const DAYS_IN_MONTH = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate();
const DAYS_LEFT_IN_MONTH = DAYS_IN_MONTH - TODAY.getDate();

function totals(effective: number, cost = (effective / 1_000_000) * COST_PER_MILLION): TokenTotals {
  const cacheRead = effective * 20;
  return {
    inputTokens: Math.round(effective * 0.02),
    outputTokens: Math.round(effective * 0.08),
    cacheCreateTokens: Math.round(effective * 0.9),
    cacheReadTokens: cacheRead,
    totalTokens: effective + cacheRead,
    effectiveTokens: effective,
    cost,
  };
}

function wave(index: number, scale: number): number {
  const weekend = index % 7 === 5 || index % 7 === 6 ? 0.35 : 1;
  return Math.round((Math.sin(index / 2.3) + 1.2) * scale * weekend);
}

function bucket(start: number, parts: Record<string, number>): Bucket {
  const effective = Object.values(parts).reduce((sum, value) => sum + value, 0);
  const scaled = (factor: number) => Object.fromEntries(Object.entries(parts).map(([model, value]) => [model, value * factor]));
  return {
    ...totals(effective),
    start,
    byModel: scaled(21),
    byModelEffective: parts,
    byModelCost: scaled(COST_PER_MILLION / 1_000_000),
  };
}

function dayStart(back: number): number {
  return startOfDay(NOW - back * DAY);
}

function sum(buckets: Bucket[]): TokenTotals {
  return buckets.reduce<TokenTotals>(
    (acc, item) => ({
      inputTokens: acc.inputTokens + item.inputTokens,
      outputTokens: acc.outputTokens + item.outputTokens,
      cacheCreateTokens: acc.cacheCreateTokens + item.cacheCreateTokens,
      cacheReadTokens: acc.cacheReadTokens + item.cacheReadTokens,
      totalTokens: acc.totalTokens + item.totalTokens,
      effectiveTokens: acc.effectiveTokens + item.effectiveTokens,
      cost: acc.cost + item.cost,
    }),
    ZERO,
  );
}

function hitRates(buckets: Bucket[], base: number, skipEvery: number): NonNullable<WeeklyData['cacheEfficiency']> {
  return buckets
    .filter((item, index) => item.totalTokens > 0 && (skipEvery === 0 || index % skipEvery !== 0))
    .map((item, index) => ({
      date: localYmd(item.start),
      hitRate: base + Math.sin(index / 2) * 6,
      cacheReadTokens: item.cacheReadTokens,
      totalTokens: item.totalTokens,
    }));
}

function weekly(buckets: Bucket[], extra: Partial<WeeklyData>): WeeklyData {
  const current = sum(buckets);
  const models = [...new Set(buckets.flatMap((item) => Object.keys(item.byModelEffective)))];
  return {
    rangeFrom: NOW - DAYS * DAY,
    rangeTo: NOW,
    weeklyResetsAt: NOW + 3 * DAY,
    buckets,
    totals: current,
    prevTotals: totals(Math.round(current.effectiveTokens * 0.82)),
    byModel: models.map((model) => ({
      model,
      ...totals(buckets.reduce((acc, item) => acc + (item.byModelEffective[model] ?? 0), 0)),
    })),
    firstEventTs: NOW - 200 * DAY,
    ...extra,
  };
}

const CLAUDE_BUCKETS: Bucket[] = Array.from({ length: DAYS }, (_, index) =>
  bucket(dayStart(DAYS - 1 - index), {
    [OPUS]: wave(index, 5_200_000),
    [SONNET]: wave(index + 2, 2_100_000),
    [HAIKU]: wave(index + 4, 400_000),
  }),
);
const CODEX_BUCKETS: Bucket[] = Array.from({ length: DAYS }, (_, index) =>
  bucket(dayStart(DAYS - 1 - index), index % 4 === 0 ? {} : { [GPT]: wave(index + 1, 900_000), [GUARDIAN]: wave(index, 120_000) }),
);
const BOTH_BUCKETS: Bucket[] = CLAUDE_BUCKETS.map((item, index) =>
  bucket(item.start, { ...item.byModelEffective, ...CODEX_BUCKETS[index].byModelEffective }),
);

const CLAUDE_TOTALS = sum(CLAUDE_BUCKETS);
const CODEX_TOTALS = sum(CODEX_BUCKETS);
const COWORK_TOTALS = totals(Math.round(CLAUDE_TOTALS.effectiveTokens * 0.16));
const CODE_TOTALS = totals(CLAUDE_TOTALS.effectiveTokens - COWORK_TOTALS.effectiveTokens);
const GUARDIAN_TOTALS = totals(
  CODEX_BUCKETS.reduce((acc, item) => acc + (item.byModelEffective[GUARDIAN] ?? 0), 0),
  0,
);
const THREAD_TOTALS = totals(CODEX_TOTALS.effectiveTokens - GUARDIAN_TOTALS.effectiveTokens);

const CLAUDE_WEEKLY = weekly(CLAUDE_BUCKETS, { cacheEfficiency: hitRates(CLAUDE_BUCKETS, 88, 0) });
const CODEX_WEEKLY = weekly(CODEX_BUCKETS, {
  cacheEfficiency: hitRates(CODEX_BUCKETS, 71, 5),
  codexSplit: { threads: THREAD_TOTALS, guardian: GUARDIAN_TOTALS },
});
const BOTH_WEEKLY = weekly(BOTH_BUCKETS, { bySource: { code: CODE_TOTALS, cowork: COWORK_TOTALS, codex: CODEX_TOTALS } });
const EMPTY_WEEKLY = weekly(
  CLAUDE_BUCKETS.map((item) => bucket(item.start, {})),
  {},
);

const COST_PER_DAY = BOTH_WEEKLY.totals.cost / DAYS;
const KPI_COMMON = {
  weekDays: DAYS,
  litellmAvailable: false,
  coverageDays: DAYS,
  daysLeftInMonth: DAYS_LEFT_IN_MONTH,
  now: NOW,
};

export const KPI_VIEWS: SpendKpisView[] = [
  buildSpendKpis({
    ...KPI_COMMON,
    weekly: BOTH_WEEKLY,
    loading: false,
    platform: 'both',
    costPerDay: COST_PER_DAY,
    projectedMonthCost: COST_PER_DAY * DAYS_IN_MONTH,
  }),
  buildSpendKpis({
    ...KPI_COMMON,
    weekly: CLAUDE_WEEKLY,
    loading: false,
    platform: 'claude',
    costPerDay: CLAUDE_WEEKLY.totals.cost / DAYS,
    projectedMonthCost: (CLAUDE_WEEKLY.totals.cost / DAYS) * DAYS_IN_MONTH,
  }),
  buildSpendKpis({ ...KPI_COMMON, weekly: null, loading: true, platform: 'claude', costPerDay: 0, projectedMonthCost: 0 }),
  buildSpendKpis({ ...KPI_COMMON, weekly: null, loading: false, platform: 'claude', costPerDay: 0, projectedMonthCost: 0 }),
];

const DAILY_COMMON = { weekDays: DAYS, coverageDays: DAYS, coworkOnly: false };

export function dailyView(metric: DailyMetric): DailyTrendView {
  return buildDailyTrend({
    ...DAILY_COMMON,
    weekly: BOTH_WEEKLY,
    loading: false,
    metric,
    costPerDay: COST_PER_DAY,
    platform: 'both',
  });
}

export const DAILY_STATE_VIEWS: DailyTrendView[] = [
  buildDailyTrend({ ...DAILY_COMMON, weekly: null, loading: true, metric: 'tokens', costPerDay: 0, platform: 'claude' }),
  buildDailyTrend({ ...DAILY_COMMON, weekly: EMPTY_WEEKLY, loading: false, metric: 'tokens', costPerDay: 0, platform: 'codex' }),
  buildDailyTrend({ ...DAILY_COMMON, weekly: null, loading: false, metric: 'cost', costPerDay: 0, platform: 'claude' }),
];

export function platformView(metric: DailyMetric): PlatformCompareView {
  return buildPlatformCompare({ claude: CLAUDE_WEEKLY, codex: CODEX_WEEKLY, loading: false, weekDays: DAYS, metric });
}

export const PLATFORM_STATE_VIEWS: PlatformCompareView[] = [
  buildPlatformCompare({ claude: null, codex: null, loading: true, weekDays: DAYS, metric: 'tokens' }),
  buildPlatformCompare({ claude: EMPTY_WEEKLY, codex: EMPTY_WEEKLY, loading: false, weekDays: DAYS, metric: 'tokens' }),
];

function utcKey(back: number): string {
  return new Date(NOW - back * DAY).toISOString().slice(0, 10);
}

const CODEX_LOCAL_DAYS: DailyActivity[] = CODEX_BUCKETS.map((item, index) => ({
  date: utcKey(DAYS - 1 - index),
  effectiveTokens: item.effectiveTokens,
  totalTokens: item.totalTokens,
  messageCount: 40,
  toolCallCount: 90,
}));
const CODEX_SERVER_DAYS = CODEX_LOCAL_DAYS.map((day, index) => ({
  date: day.date,
  tokens: Math.round((day.totalTokens ?? 0) * (index === DAYS - 1 ? 0.4 : 1.16)),
}));

export const CODEX_COMPARE_VIEWS: CodexCompareView[] = [
  buildCodexCompare({ server: CODEX_SERVER_DAYS, local: CODEX_LOCAL_DAYS, loading: false, failed: false, days: DAYS, now: NOW }),
  buildCodexCompare({ server: [], local: [], loading: false, failed: false, days: DAYS, now: NOW }),
];

export const GROUPED_ROWS: CompareRowView[] = Array.from({ length: 14 }, (_, index) => {
  const planned = 40 + wave(index, 30);
  const actual = Math.round(planned * (0.7 + (index % 5) * 0.12));
  return {
    label: new Date(dayStart(13 - index)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    title: new Date(dayStart(13 - index)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    footer: `Codex share ${Math.round((actual / (planned + actual)) * 100)}%`,
    values: { claude: planned, codex: actual },
  };
});
export const GROUPED_SERIES: TrendsLegendItem[] = [
  { key: 'claude', label: 'Claude', color: PLATFORM_COLORS.claude, value: '~$1,204' },
  { key: 'codex', label: 'Codex', color: PLATFORM_COLORS.codex, value: '~$938' },
];

export const SOURCES_VIEWS: SourcesSplitView[] = [
  buildSourcesSplit(computeSourceSplit({ code: CODE_TOTALS, cowork: COWORK_TOTALS, codex: CODEX_TOTALS }), DAYS, 'both'),
  buildSourcesSplit(computeCodexSplit({ threads: THREAD_TOTALS, guardian: GUARDIAN_TOTALS }), DAYS, 'codex'),
].filter((view): view is SourcesSplitView => view !== null);

const CACHE_COMMON = { loading: false, failed: false, weekDays: DAYS };

export const CACHE_VIEWS: CacheEfficiencyView[] = [
  buildCacheEfficiency({ ...CACHE_COMMON, series: cacheSeriesFor('claude', CLAUDE_WEEKLY, null, null), platform: 'claude' }),
  buildCacheEfficiency({ ...CACHE_COMMON, series: cacheSeriesFor('both', null, CLAUDE_WEEKLY, CODEX_WEEKLY), platform: 'both' }),
];
export const CACHE_STATE_VIEWS: CacheEfficiencyView[] = [
  buildCacheEfficiency({ ...CACHE_COMMON, loading: true, series: cacheSeriesFor('claude', null, null, null), platform: 'claude' }),
  buildCacheEfficiency({ ...CACHE_COMMON, series: cacheSeriesFor('claude', EMPTY_WEEKLY, null, null), platform: 'claude' }),
  buildCacheEfficiency({ ...CACHE_COMMON, failed: true, series: cacheSeriesFor('claude', null, null, null), platform: 'claude' }),
];

const HOUR_GRID: number[][] = Array.from({ length: 7 }, (_, day) =>
  Array.from({ length: 24 }, (_, hour) => {
    const working = hour >= 9 && hour <= 18 ? 1 : hour >= 20 ? 0.45 : 0.04;
    const weekend = day >= 5 ? 0.25 : 1;
    const value = Math.round((Math.sin((hour + day * 3) / 2.1) + 1.1) * 900_000 * working * weekend);
    return value < 60_000 ? 0 : value;
  }),
);

export const PEAK_VIEWS: PeakHoursView[] = [
  buildPeakHours({ grid: HOUR_GRID, loading: false, weekStart: 'monday', platform: 'claude' }),
  buildPeakHours({ grid: null, loading: true, weekStart: 'monday', platform: 'claude' }),
  buildPeakHours({ grid: HOUR_GRID.map((row) => row.map(() => 0)), loading: false, weekStart: 'monday', platform: 'codex' }),
];

const ACTIVITY_DAYS: DailyActivity[] = Array.from({ length: 126 }, (_, index) => {
  const tokens = index % 9 === 0 ? 0 : wave(index, index > 100 ? 9_000_000 : 2_400_000);
  return {
    date: localYmd(dayStart(125 - index)),
    effectiveTokens: tokens,
    totalTokens: tokens * 21,
    messageCount: Math.round(tokens / 40_000),
    toolCallCount: Math.round(tokens / 18_000),
  };
});

export const ACTIVITY_VIEWS: ActivityHeatmapView[] = [
  buildActivityHeatmap({ days: ACTIVITY_DAYS, loading: false, weekStart: 'monday', platform: 'claude', now: NOW }),
  buildActivityHeatmap({ days: null, loading: true, weekStart: 'monday', platform: 'claude', now: NOW }),
];

function usage(effective: number, activeDays: number, streak: number): UsageSummary {
  return {
    firstEventTs: NOW - 196 * DAY,
    lastEventTs: NOW,
    lifetimeEffectiveTokens: effective,
    lifetimeTotalTokens: effective * 21,
    lifetimeCost: (effective / 1_000_000) * COST_PER_MILLION,
    peakDay: { date: localYmd(dayStart(8)), effectiveTokens: Math.round(effective / 12) },
    currentStreakDays: streak,
    longestStreakDays: streak + 14,
    activeDays,
    spanDays: 196,
  };
}

const SUMMARY: UsageSummaryData = {
  ...usage(423_000_000, 100, 30),
  byPlatform: { claude: usage(403_000_000, 96, 30), codex: usage(20_000_000, 21, 2) },
};

export const SUMMARY_VIEWS: ActivitySummaryView[] = [
  buildActivitySummary({ summary: SUMMARY, loading: false, platform: 'both', codexServerLifetime: 483_000_000 }),
  buildActivitySummary({ summary: null, loading: true, platform: 'claude', codexServerLifetime: null }),
];

const BILLED_DAYS: LiteLlmSpend['daily'] = Array.from({ length: DAYS }, (_, index) => {
  const cost = index % 6 === 5 ? 0 : 20 + ((index * 37) % 90);
  return {
    date: localYmd(dayStart(DAYS - 1 - index)),
    cost,
    requests: 120 + index * 7,
    successful: 116 + index * 7,
    byModel: { [OPUS]: cost * 0.7, [SONNET]: cost * 0.25, [HAIKU]: cost * 0.05 },
  };
});

const SPEND: LiteLlmSpend = {
  monthLabel: 'October',
  monthToDate: 412.37,
  monthRequests: 8123,
  monthSuccessful: 7790,
  monthFailed: 333,
  monthTokens: { prompt: 12_000_000, completion: 3_200_000, cacheRead: 410_000_000, cacheCreate: 28_000_000 },
  prevMonthLabel: 'September',
  prevMonthToDate: 367.9,
  lifetime: { user: 5120.5, key: 0 },
  daily: BILLED_DAYS,
  truncated: true,
};

export const BILLED_VIEWS: LiteLlmBilledView[] = [
  buildLiteLlmBilled({ spend: SPEND, loading: false, host: 'gateway.example.test', weekDays: DAYS }),
  buildLiteLlmBilled({ spend: null, loading: true, host: 'gateway.example.test', weekDays: DAYS }),
  buildLiteLlmBilled({ spend: null, loading: false, host: '', weekDays: DAYS }),
];
