import { PLATFORM_COLORS } from '@/lib/chart-theme';
import { compact, dayLabel, dayLabelWithYear, longDateLabel, shortModel, usd, ymdLabel } from '@/lib/format';
import { modelColor } from '@/lib/palette';
import { PLATFORM_NOUN, SURFACE_COLOR, SURFACE_LABEL, type Platform } from '@/lib/platform';
import type { SectionSkeleton, SectionState } from '@/lib/section';
import { localYmd, type WeekStart } from '@/lib/week';
import type {
  Bucket,
  CodexSplit,
  DailyActivity,
  LiteLlmSpend,
  ModelShare,
  SourceSplit,
  TokenTotals,
  UsageSource,
  UsageSummary,
  UsageSummaryData,
  WeeklyData,
} from '@/types';

export type DailyMetric = 'tokens' | 'cost';
export type TrendsViewId = 'spend' | 'efficiency' | 'activity';
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface TrendsOption<T extends string = string> {
  value: T;
  label: string;
}

export interface CacheEfficiencyPoint {
  date: string;
  hitRate: number;
  cacheReadTokens: number;
  totalTokens: number;
}

export interface CacheSeries {
  key: string;
  label: string;
  color: string;
  points: CacheEfficiencyPoint[];
}

export interface SplitSegment {
  key: string;
  label: string;
  color: string;
  effectiveTokens: number;
  cost: number;
  pct: number;
}

export interface TrendsLegendItem {
  key: string;
  label: string;
  color: string;
  value: string;
}

export interface TrendsTileView {
  key: string;
  label: string;
  value: string;
  lines: string[];
  help: string;
  tone: 'default' | 'accent';
}

export interface TrendsMessage {
  title: string;
  description: string;
}

export interface SpendKpisView {
  status: 'loading' | 'error' | 'ready';
  tiles: TrendsTileView[];
  message: TrendsMessage | null;
}

export interface SpendKpisInput {
  weekly: WeeklyData | null;
  loading: boolean;
  weekDays: number;
  platform: Platform;
  litellmAvailable: boolean;
  costPerDay: number;
  coverageDays: number;
  daysLeftInMonth: number;
  projectedMonthCost: number;
  now: number;
}

export interface TrendDeltaView {
  label: string;
  up: boolean;
}

export interface DailyTrendView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  buckets: Bucket[];
  metric: DailyMetric;
  withYear: boolean;
  costPerDay: number;
  tokensPerDay: number;
  delta: TrendDeltaView | null;
  canExport: boolean;
}

export interface DailyTrendInput {
  weekly: WeeklyData | null;
  loading: boolean;
  weekDays: number;
  metric: DailyMetric;
  costPerDay: number;
  coverageDays: number;
  platform: Platform;
  coworkOnly: boolean;
}

export interface CompareRowView {
  label: string;
  title: string;
  footer: string | null;
  values: Record<string, number>;
}

export interface PlatformCompareView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  metric: DailyMetric;
  rows: CompareRowView[];
  legend: TrendsLegendItem[];
  share: string | null;
}

export interface PlatformCompareInput {
  claude: WeeklyData | null;
  codex: WeeklyData | null;
  loading: boolean;
  weekDays: number;
  metric: DailyMetric;
}

export interface CodexCompareView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  rows: CompareRowView[];
  legend: TrendsLegendItem[];
  delta: string | null;
}

export interface CodexCompareInput {
  server: { date: string; tokens: number }[];
  local: DailyActivity[];
  loading: boolean;
  days: number;
  now: number;
}

export interface SourcesSplitRowView {
  key: string;
  label: string;
  color: string;
  width: number;
  tokens: string;
  percent: string;
  cost: string | null;
}

export interface SourcesSplitView {
  title: string;
  description: string;
  help: string;
  rows: SourcesSplitRowView[];
}

export interface CacheSeriesView {
  key: string;
  label: string;
  color: string;
}

export interface CacheStatView {
  key: string;
  label: string;
  value: string;
}

export type CacheChartRow = Record<string, string | number | undefined>;

export interface CacheEfficiencyView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  series: CacheSeriesView[];
  rows: CacheChartRow[];
  points: Record<string, Record<string, CacheEfficiencyPoint>>;
  stats: CacheStatView[];
  average: number | null;
}

export interface CacheEfficiencyInput {
  series: CacheSeries[];
  loading: boolean;
  failed: boolean;
  weekDays: number;
  platform: Platform;
}

export interface HeatCellView {
  key: string;
  level: HeatLevel;
  label: string;
}

export interface PeakHoursRowView {
  key: string;
  label: string;
  cells: HeatCellView[];
}

export interface PeakMomentView {
  when: string;
  tokens: string;
}

export interface PeakHoursView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  hours: string[];
  rows: PeakHoursRowView[];
  peak: PeakMomentView | null;
}

export interface PeakHoursInput {
  grid: number[][] | null;
  loading: boolean;
  weekStart: WeekStart;
  platform: Platform;
}

export interface ActivityCellView {
  key: string;
  day: number;
  level: HeatLevel;
  future: boolean;
  tokens: string | null;
  label: string;
}

export interface ActivityRowView {
  key: string;
  label: string;
  cells: ActivityCellView[];
}

export interface ActivityHeatmapView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  months: string[];
  rows: ActivityRowView[];
  peak: PeakMomentView | null;
}

export interface ActivityHeatmapInput {
  days: DailyActivity[] | null;
  loading: boolean;
  weekStart: WeekStart;
  platform: Platform;
  now: number;
}

export interface ActivitySummaryView {
  status: 'loading' | 'error' | 'hidden' | 'ready';
  tiles: TrendsTileView[];
  message: TrendsMessage | null;
}

export interface ActivitySummaryInput {
  summary: UsageSummaryData | null;
  loading: boolean;
  platform: Platform;
  codexServerLifetime: number | null | undefined;
}

export interface LiteLlmFactView {
  key: string;
  label: string;
  value: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
}

export interface LiteLlmMonthView {
  label: string;
  value: string;
  facts: LiteLlmFactView[];
}

export interface LiteLlmDayModelView {
  label: string;
  value: string;
  color: string;
}

export interface LiteLlmDayView {
  key: string;
  label: string;
  title: string;
  cost: number;
  today: boolean;
  color: string;
  models: LiteLlmDayModelView[];
  successful: string;
}

export interface LiteLlmMixSegmentView {
  key: string;
  label: string;
  value: string;
  percent: number;
  color: string;
}

export interface LiteLlmMixView {
  label: string;
  total: string;
  segments: LiteLlmMixSegmentView[];
}

export interface LiteLlmBilledView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  month: LiteLlmMonthView | null;
  windowLabel: string;
  windowTotal: string;
  days: LiteLlmDayView[];
  truncated: string | null;
  mix: LiteLlmMixView | null;
}

export interface LiteLlmBilledInput {
  spend: LiteLlmSpend | null;
  loading: boolean;
  host: string;
  weekDays: number;
}

export type AiTrendsBucket = Omit<Bucket, 'byModel' | 'byModelCost'>;

export type AiTrendsPayload = Omit<WeeklyData, 'buckets'> & { buckets: AiTrendsBucket[]; daysPerBucket?: number };

const DAY_MS = 86_400_000;
const SERVER_DOWN = 'The dashboard server did not answer. It keeps retrying.';
const NO_BUCKETS: Bucket[] = [];
const AI_MAX_BUCKETS = 60;
const LONG_RANGE_DAYS = 60;
const HEATMAP_DAYS = 90;
const SUCCESS_GOOD_PCT = 99;
const SUCCESS_WARN_PCT = 95;

export const ACTIVITY_WEEKS = 18;
export const TRENDS_VIEW_PARAM = 'view';
export const DEFAULT_TRENDS_VIEW: TrendsViewId = 'spend';

export const TRENDS_VIEWS: readonly TrendsOption<TrendsViewId>[] = [
  { value: 'spend', label: 'Spend' },
  { value: 'efficiency', label: 'Efficiency' },
  { value: 'activity', label: 'Activity' },
];

// The server clamps `days` to MAX_WINDOW_DAYS (365).
export const TIME_WINDOWS: { days: number; label: string }[] = [
  { days: 7, label: '1w' },
  { days: 14, label: '2w' },
  { days: 30, label: '1m' },
  { days: 60, label: '2m' },
  { days: 90, label: '3m' },
  { days: 180, label: '6m' },
  { days: 365, label: '1y' },
];

export const TRENDS_RANGE_OPTIONS: readonly TrendsOption[] = TIME_WINDOWS.map(({ days, label }) => ({
  value: String(days),
  label,
}));

export const DAILY_METRIC_OPTIONS: readonly TrendsOption<DailyMetric>[] = [
  { value: 'tokens', label: 'Tokens' },
  { value: 'cost', label: 'Cost' },
];

export const SOURCE_COLOR: Record<UsageSource, string> = {
  code: SURFACE_COLOR.code,
  cowork: SURFACE_COLOR.cowork,
  codex: SURFACE_COLOR.codex,
};

export const SOURCE_LABEL: Record<UsageSource, string> = {
  code: SURFACE_LABEL.code,
  cowork: SURFACE_LABEL.cowork,
  codex: SURFACE_LABEL.codex,
};

export const SOURCE_ORDER: UsageSource[] = ['code', 'cowork', 'codex'];

// Guardian takes its model's palette colour, so the reviewer is one colour on every chart.
export const CODEX_KIND_COLOR = { threads: SOURCE_COLOR.codex, guardian: modelColor('codex-auto-review') } as const;
export const CODEX_KIND_LABEL = { threads: 'Threads', guardian: 'Guardian reviews' } as const;

const USAGE_HINT: Record<Platform, string> = {
  claude: 'Use Claude Code and the days fill in.',
  codex: 'Run a thread in the ChatGPT desktop app and the days fill in.',
  both: 'Use Claude Code or Codex and the days fill in.',
};
const COWORK_HINT = 'Use Cowork and the days fill in.';

const token = (name: string) => `rgb(var(--${name}))`;
const SERVER_SERIES_COLOR = PLATFORM_COLORS.codex;
const LOCAL_SERIES_COLOR = token('tag-6');
const SINGLE_CACHE_COLOR = token('success');
const SINGLE_CACHE_KEY = 'rate';
const BILLED_COLOR = token('success');
const BILLED_TODAY_COLOR = token('success-fg');
const MIX_COLORS = { prompt: token('tag-1'), completion: token('tag-2'), cacheCreate: token('tag-4'), cacheRead: token('tag-3') };

const WEEKDAYS_FROM_MONDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_NAMES_FROM_MONDAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAYS_FROM_SUNDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOURS_IN_DAY = 24;
const HOUR_LABEL_EVERY = 3;

function estimate(n: number): string {
  return `~${usd(n)}`;
}

function signed(percent: number): string {
  return `${percent >= 0 ? '+' : ''}${percent}%`;
}

function present(...items: (string | null)[]): string[] {
  return items.filter((item): item is string => !!item);
}

function pending(loading: boolean, title: string, skeleton: SectionSkeleton, rows?: number): SectionState {
  return loading ? { kind: 'loading', skeleton, rows } : { kind: 'error', title, description: SERVER_DOWN };
}

function axisDay(weekDays: number): (ms: number) => string {
  return weekDays > LONG_RANGE_DAYS ? dayLabelWithYear : dayLabel;
}

export function dayTitleWithYear(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function parseTrendsView(raw: string | null): TrendsViewId {
  return TRENDS_VIEWS.find((view) => view.value === raw)?.value ?? DEFAULT_TRENDS_VIEW;
}

export function rangeText(days: number): string {
  return `Last ${days} days`;
}

export function costBasisHelp(platform: Platform, litellmAvailable: boolean): string {
  if (platform === 'claude' && litellmAvailable) {
    return "Estimated from your local logs at Anthropic's public API rates — a reference figure. Compare it with “Actual billed” (your gateway's real charge): the two differ because the gateway also bills failed/retried requests, uses calendar-day windows, and reflects a more up-to-date snapshot.";
  }
  if (platform === 'codex') {
    return "What this usage would cost at OpenAI's pay-as-you-go API rates. Your ChatGPT subscription has no per-token bill — this is a reference figure only. The internal guardian review model is unpriced.";
  }
  if (platform === 'both') {
    return "What this usage would cost at Anthropic's and OpenAI's pay-as-you-go API rates, added together. Neither subscription has a per-token bill — this is a reference figure only.";
  }
  return "What this usage would cost at Anthropic's pay-as-you-go API rates. Your subscription has no per-token bill — this is a reference figure only.";
}

// OpenAI publishes no token basis for the Codex limits, so the Codex copy only says what the number is and why it is comparable.
export function effectiveTokensHelp(platform: Platform): string {
  if (platform === 'codex') {
    return 'Uncached input + output tokens. Cached input is excluded — the counterpart of cache reads on Claude — so the figure is comparable across platforms. OpenAI does not publish how tokens weigh against the Codex limits. Compared against the previous period.';
  }
  if (platform === 'both') {
    return 'Input + output + cache-write tokens on both platforms (Codex never reports cache writes). Cache reads and cached input are excluded — cheap context reuse, not new work. Compared against the previous period.';
  }
  return 'Input + output + cache-write tokens — the tokens that count toward rate limits. Cheap cache reads are excluded. Compared against the previous period.';
}

export function cacheEfficiencyHelp(platform: Platform): string {
  if (platform === 'codex') {
    return "Share of all tokens served from OpenAI's prompt cache each day (cached input ÷ all tokens). Codex caches automatically and never bills a cache write; higher means more context was reused instead of re-sent.";
  }
  if (platform === 'both') {
    return 'Share of all tokens served from the prompt cache each day (cache reads ÷ all tokens), one line per platform — the two vendors cache differently (Anthropic bills cache writes, OpenAI caches automatically), so a blended rate would describe neither.';
  }
  return 'Share of total tokens served from the prompt cache each day (cache reads ÷ all tokens). Higher means more context was reused cheaply instead of re-sent.';
}

export function sourcesHelp(platform: Platform): string {
  if (platform === 'codex') {
    return 'Split of Codex effective tokens (and equivalent cost) between your own threads and the guardian auto-reviews that check their actions, over the selected window. Guardian reviews run on an internal model that is not priced.';
  }
  if (platform === 'both') {
    return 'Split of effective tokens (and equivalent cost) between Claude Code (CLI), Cowork (desktop local-agent mode) and Codex (ChatGPT desktop) over the selected window.';
  }
  return 'Split of effective tokens (and equivalent cost) between Claude Code (CLI) and Cowork (desktop local-agent mode) over the selected window.';
}

function costPerDayHelp(platform: Platform): string {
  const cause = platform === 'codex' ? 'a new install' : "a new install, or Claude Code's ~30-day transcript cleanup";
  return `Estimated equivalent API cost averaged over the selected window (total cost ÷ days). When your logs start inside the window (${cause}), it divides by the days that have history instead.`;
}

// Reads the same window's byModel (the tile's own poll), never the fixed 7-day models poll.
export function topModelByCost(byModel: ModelShare[] | undefined): { model: string; pct: number } | null {
  if (!byModel?.length) return null;
  const total = byModel.reduce((sum, share) => sum + share.cost, 0);
  if (total <= 0) return null;
  const top = byModel.reduce((best, share) => (share.cost > best.cost ? share : best));
  return { model: top.model, pct: Math.round((top.cost / total) * 100) };
}

// `scale` re-expresses the window total in the tile's own unit: 1/days for a per-day average, daysInMonth/days for the month projection.
export function platformSplitLabel(
  bySource: SourceSplit | undefined,
  field: 'cost' | 'effectiveTokens',
  fmt: (n: number) => string,
  scale = 1,
): string | null {
  if (!bySource) return null;
  const claude = (bySource.code[field] + bySource.cowork[field]) * scale;
  const codex = bySource.codex[field] * scale;
  if (claude === 0 && codex === 0) return null;
  return `Claude ${fmt(claude)} · Codex ${fmt(codex)}`;
}

// Compares against the preceding N rolling days, so past two weeks it names the days: "previous month" would imply a calendar month.
export function prevPeriodLabel(days: number): string {
  if (days === 7) return 'Previous week';
  if (days === 14) return 'Previous 2 weeks';
  return `Previous ${days} days`;
}

export function buildSpendKpis({
  weekly,
  loading,
  weekDays,
  platform,
  litellmAvailable,
  costPerDay,
  coverageDays,
  daysLeftInMonth,
  projectedMonthCost,
  now,
}: SpendKpisInput): SpendKpisView {
  if (!weekly) {
    return loading
      ? { status: 'loading', tiles: [], message: null }
      : { status: 'error', tiles: [], message: { title: 'Could not load spend', description: SERVER_DOWN } };
  }
  const split = platform === 'both' ? weekly.bySource : undefined;
  const top = topModelByCost(weekly.byModel);
  const previous = weekly.prevTotals.effectiveTokens;
  const daysThisMonth = new Date(now).getDate() + daysLeftInMonth;
  const tiles: TrendsTileView[] = [
    {
      key: 'cost',
      label: `Est. cost · ${weekDays}d`,
      value: estimate(weekly.totals.cost),
      lines: present(
        top ? `Top: ${shortModel(top.model)}, ${top.pct}%` : null,
        platformSplitLabel(split, 'cost', estimate),
      ),
      help: costBasisHelp(platform, litellmAvailable),
      tone: 'default',
    },
    {
      key: 'tokens',
      label: `Effective tokens · ${weekDays}d`,
      value: compact(weekly.totals.effectiveTokens),
      lines: present(
        previous > 0 ? `${prevPeriodLabel(weekDays)}: ${compact(previous)}` : `${compact(weekly.totals.outputTokens)} output`,
        platformSplitLabel(split, 'effectiveTokens', compact),
      ),
      help: effectiveTokensHelp(platform),
      tone: 'default',
    },
    {
      key: 'perDay',
      label: 'Avg cost per day',
      value: estimate(costPerDay),
      lines: present(
        coverageDays < weekDays ? `Over ${coverageDays} days with history` : `Over ${weekDays} days`,
        platformSplitLabel(split, 'cost', estimate, 1 / coverageDays),
      ),
      help: costPerDayHelp(platform),
      tone: 'default',
    },
    {
      key: 'projected',
      label: 'Projected this month',
      value: estimate(projectedMonthCost),
      lines: present(
        `${daysLeftInMonth} days left in month`,
        platformSplitLabel(split, 'cost', estimate, daysThisMonth / coverageDays),
      ),
      help: 'Estimated month-end equivalent cost if your current average daily spend continues for the rest of the calendar month.',
      tone: 'accent',
    },
  ];
  return { status: 'ready', tiles, message: null };
}

export function trendDelta(data: WeeklyData | null, metric: DailyMetric): number | null {
  if (!data) return null;
  const current = metric === 'cost' ? data.totals.cost : data.totals.effectiveTokens;
  const previous = metric === 'cost' ? data.prevTotals.cost : data.prevTotals.effectiveTokens;
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

// Every row carries every model column (0 when idle): CSV headers come from the first row, often an empty day on a long window.
export function trendExport(data: WeeklyData, weekDays: number) {
  const perModel = (bucket: Bucket) => bucket.byModelEffective ?? bucket.byModel;
  const models = [...new Set(data.buckets.flatMap((bucket) => Object.keys(perModel(bucket))))];
  const csv = data.buckets.map((bucket) => ({
    date: localYmd(bucket.start),
    effectiveTokens: bucket.effectiveTokens,
    totalTokens: bucket.totalTokens,
    cost: bucket.cost.toFixed(4),
    ...Object.fromEntries(models.map((model) => [model, perModel(bucket)[model] ?? 0])),
  }));
  return { csv, json: data.buckets, filename: `trends-${weekDays}d` };
}

export function buildDailyTrend({
  weekly,
  loading,
  weekDays,
  metric,
  costPerDay,
  coverageDays,
  platform,
  coworkOnly,
}: DailyTrendInput): DailyTrendView {
  const delta = trendDelta(weekly, metric);
  const view: DailyTrendView = {
    title: metric === 'cost' ? 'Daily est. cost by model' : 'Daily effective tokens by model',
    description: `${rangeText(weekDays)}, stacked by model`,
    help: 'Daily effective tokens (input + output + cache writes; cheap cache reads are excluded and shown only in the tooltip) or estimated equivalent cost, stacked by model. The bars past today are a projection from your recent daily average. Switch between tokens and cost on the right; change the window with the picker at the top of the page.',
    state: null,
    buckets: weekly?.buckets ?? NO_BUCKETS,
    metric,
    withYear: weekDays > LONG_RANGE_DAYS,
    costPerDay,
    tokensPerDay: (weekly?.totals.effectiveTokens ?? 0) / coverageDays,
    delta: delta === null ? null : { label: `${signed(delta)} vs previous period`, up: delta > 0 },
    canExport: !!weekly,
  };
  if (!weekly) return { ...view, state: pending(loading, 'Could not load daily usage', 'chart', Math.min(weekDays, 30)) };
  if (weekly.totals.totalTokens === 0) {
    return {
      ...view,
      state: {
        kind: 'empty',
        title: `No usage in the last ${weekDays} days`,
        description: coworkOnly ? COWORK_HINT : USAGE_HINT[platform],
      },
    };
  }
  return view;
}

// The two responses are built over the same window, so the starts line up; a day only one platform has still gets a row.
export function mergePlatformDaily(
  claude: WeeklyData | null,
  codex: WeeklyData | null,
  metric: DailyMetric,
  weekDays: number,
): CompareRowView[] {
  const pick = (bucket: Bucket) => (metric === 'cost' ? bucket.cost : bucket.effectiveTokens);
  const claudeByStart = new Map((claude?.buckets ?? []).map((bucket) => [bucket.start, pick(bucket)]));
  const codexByStart = new Map((codex?.buckets ?? []).map((bucket) => [bucket.start, pick(bucket)]));
  const starts = [...new Set([...claudeByStart.keys(), ...codexByStart.keys()])].sort((a, b) => a - b);
  const label = axisDay(weekDays);
  const title = weekDays > LONG_RANGE_DAYS ? dayTitleWithYear : dayLabel;
  return starts.map((start) => {
    const claudeValue = claudeByStart.get(start) ?? 0;
    const codexValue = codexByStart.get(start) ?? 0;
    const total = claudeValue + codexValue;
    return {
      label: label(start),
      title: title(start),
      footer: total > 0 ? `Codex share ${Math.round((codexValue / total) * 100)}%` : null,
      values: { claude: claudeValue, codex: codexValue },
    };
  });
}

// Read from each response's `totals`, not by summing the bars: the earliest calendar-day bucket reaches back before `rangeFrom`.
export function platformTotals(
  claude: WeeklyData | null,
  codex: WeeklyData | null,
  metric: DailyMetric,
): { claude: number; codex: number; codexSharePct: number | null } {
  const pick = (weekly: WeeklyData | null) => (!weekly ? 0 : metric === 'cost' ? weekly.totals.cost : weekly.totals.effectiveTokens);
  const claudeTotal = pick(claude);
  const codexTotal = pick(codex);
  const sum = claudeTotal + codexTotal;
  return { claude: claudeTotal, codex: codexTotal, codexSharePct: sum > 0 ? Math.round((codexTotal / sum) * 100) : null };
}

export function buildPlatformCompare({ claude, codex, loading, weekDays, metric }: PlatformCompareInput): PlatformCompareView {
  const rows = mergePlatformDaily(claude, codex, metric, weekDays);
  const totals = platformTotals(claude, codex, metric);
  const format = metric === 'cost' ? estimate : compact;
  const hasData = rows.some((row) => row.values.claude > 0 || row.values.codex > 0);
  const view: PlatformCompareView = {
    title: metric === 'cost' ? 'Daily est. cost by platform' : 'Daily effective tokens by platform',
    description: `Claude and Codex side by side, ${rangeText(weekDays).toLowerCase()}`,
    help: "Per-day effective tokens (or estimated equivalent API cost) for Claude — Claude Code plus Cowork — beside Codex in the ChatGPT desktop app, over the selected window. Cost is each vendor's own list-price equivalent, so the two bars are comparable in size but neither is a real bill.",
    state: null,
    metric,
    rows,
    legend: [
      { key: 'claude', label: 'Claude (Code + Cowork)', color: PLATFORM_COLORS.claude, value: format(totals.claude) },
      { key: 'codex', label: 'Codex (ChatGPT desktop)', color: PLATFORM_COLORS.codex, value: format(totals.codex) },
    ],
    share: totals.codexSharePct === null ? null : `${totals.codexSharePct}% Codex`,
  };
  if (loading) return { ...view, state: { kind: 'loading', skeleton: 'chart', rows: Math.min(weekDays, 30) } };
  if (hasData) return view;
  if (!claude && !codex) return { ...view, state: pending(false, 'Could not load the platform comparison', 'chart') };
  return {
    ...view,
    state: { kind: 'empty', title: `No usage in the last ${weekDays} days`, description: USAGE_HINT.both },
  };
}

// Joined by UTC day key on `totalTokens`, the unit OpenAI's server count is in (far above effective tokens on a cache-heavy day).
export function mergeCodexDaily(
  server: { date: string; tokens: number }[],
  local: DailyActivity[],
  days: number,
  now: number,
): CompareRowView[] {
  const serverByDate = new Map(server.map((day) => [day.date, day.tokens]));
  const localByDate = new Map(local.map((day) => [day.date, day.totalTokens ?? 0]));
  const today = new Date(now);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const rows: CompareRowView[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const date = new Date(start - back * DAY_MS).toISOString().slice(0, 10);
    const serverValue = serverByDate.get(date) ?? 0;
    const localValue = localByDate.get(date) ?? 0;
    rows.push({
      label: ymdLabel(date, days > LONG_RANGE_DAYS),
      title: `${ymdLabel(date, true)} (UTC)`,
      footer:
        serverValue > 0 ? `Local vs server ${signed(Math.round(((localValue - serverValue) / serverValue) * 100))}` : null,
      values: { server: serverValue, local: localValue },
    });
  }
  return rows;
}

export function buildCodexCompare({ server, local, loading, days, now }: CodexCompareInput): CodexCompareView {
  const rows = mergeCodexDaily(server, local, days, now);
  const serverTotal = rows.reduce((sum, row) => sum + row.values.server, 0);
  const localTotal = rows.reduce((sum, row) => sum + row.values.local, 0);
  const deltaPct = serverTotal > 0 ? Math.round(((localTotal - serverTotal) / serverTotal) * 100) : null;
  const hasData = rows.some((row) => row.values.server > 0 || row.values.local > 0);
  const view: CodexCompareView = {
    title: 'Codex server count vs local rollouts',
    description: `All tokens per UTC day, ${rangeText(days).toLowerCase()}`,
    help: "OpenAI's own per-day token count for your account (includes mobile and web Codex) beside the sum of the local rollouts on this machine. Both series are UTC days and count every token, cached input included, so each pair of bars measures the same thing; expect the local bar at or a little below the server one (other devices), and the newest server day to lag while OpenAI catches up.",
    state: null,
    rows,
    legend: [
      { key: 'server', label: 'Server (OpenAI, all devices)', color: SERVER_SERIES_COLOR, value: compact(serverTotal) },
      { key: 'local', label: 'Local rollouts (this machine)', color: LOCAL_SERIES_COLOR, value: compact(localTotal) },
    ],
    delta: deltaPct === null ? null : `Local ${signed(deltaPct)} vs server`,
  };
  if (loading) return { ...view, state: { kind: 'loading', skeleton: 'chart', rows: Math.min(days, 30) } };
  if (hasData) return view;
  return {
    ...view,
    state: {
      kind: 'empty',
      title: 'No daily data yet',
      description: 'Run a thread in the ChatGPT desktop app and the days fill in.',
    },
  };
}

function segments(parts: { key: string; label: string; color: string; totals: TokenTotals }[]): SplitSegment[] {
  const total = parts.reduce((sum, part) => sum + part.totals.effectiveTokens, 0);
  return parts
    .filter((part) => part.totals.effectiveTokens > 0)
    .map((part) => ({
      key: part.key,
      label: part.label,
      color: part.color,
      effectiveTokens: part.totals.effectiveTokens,
      cost: part.totals.cost,
      pct: total > 0 ? (part.totals.effectiveTokens / total) * 100 : 0,
    }));
}

export function computeSourceSplit(bySource: SourceSplit): SplitSegment[] {
  return segments(
    SOURCE_ORDER.map((key) => ({ key, label: SOURCE_LABEL[key], color: SOURCE_COLOR[key], totals: bySource[key] })),
  );
}

export function computeCodexSplit(codexSplit: CodexSplit): SplitSegment[] {
  return segments([
    { key: 'threads', label: CODEX_KIND_LABEL.threads, color: CODEX_KIND_COLOR.threads, totals: codexSplit.threads },
    { key: 'guardian', label: CODEX_KIND_LABEL.guardian, color: CODEX_KIND_COLOR.guardian, totals: codexSplit.guardian },
  ]);
}

// A $0 segment (the unpriced guardian model) shows tokens only.
export function buildSourcesSplit(
  splitSegments: SplitSegment[] | null,
  weekDays: number,
  platform: Platform,
): SourcesSplitView | null {
  if (!splitSegments || splitSegments.length === 0) return null;
  const codex = platform === 'codex';
  return {
    title: codex ? 'Threads and reviews' : 'Where it ran',
    description: `Share of effective tokens by ${codex ? 'thread kind' : 'surface'}, ${rangeText(weekDays).toLowerCase()}`,
    help: sourcesHelp(platform),
    rows: splitSegments.map((segment) => ({
      key: segment.key,
      label: segment.label,
      color: segment.color,
      width: segment.pct,
      tokens: compact(segment.effectiveTokens),
      percent: segment.pct > 0 && segment.pct < 1 ? '<1%' : `${segment.pct.toFixed(0)}%`,
      cost: segment.cost > 0 ? estimate(segment.cost) : null,
    })),
  };
}

// Days without usage are absent, not zero.
export function avgHitRate(points: CacheEfficiencyPoint[]): number {
  return points.length ? points.reduce((sum, point) => sum + point.hitRate, 0) / points.length : 0;
}

function rate(value: number): string {
  return `${value.toFixed(1)}%`;
}

// A day a platform was idle stays `undefined`, so its line breaks there instead of dipping to a fake 0%.
export function buildCacheEfficiency({ series, loading, failed, weekDays, platform }: CacheEfficiencyInput): CacheEfficiencyView {
  const shown = series.filter((entry) => entry.points.length > 0);
  const view: CacheEfficiencyView = {
    title: 'Cache hit rate',
    description: `Share of all tokens served from the prompt cache per day, ${rangeText(weekDays).toLowerCase()}`,
    help: cacheEfficiencyHelp(platform),
    state: null,
    series: shown.map(({ key, label, color }) => ({ key, label, color })),
    rows: [],
    points: {},
    stats: [],
    average: null,
  };
  if (loading && shown.length < series.length) {
    return { ...view, state: { kind: 'loading', skeleton: 'chart', rows: Math.min(weekDays, 30) } };
  }
  if (shown.length === 0) {
    if (failed) return { ...view, state: pending(false, 'Could not load cache efficiency', 'chart') };
    return {
      ...view,
      state: {
        kind: 'empty',
        title: `No cache data in the last ${weekDays} days`,
        description: 'The hit rate appears once there is usage in the selected window.',
      },
    };
  }
  const points: Record<string, Record<string, CacheEfficiencyPoint>> = {};
  for (const entry of shown) points[entry.key] = Object.fromEntries(entry.points.map((point) => [point.date, point]));
  const dates = [...new Set(shown.flatMap((entry) => entry.points.map((point) => point.date)))].sort();
  const withYear = weekDays > LONG_RANGE_DAYS;
  const rows = dates.map((date) => {
    const row: CacheChartRow = { date, label: ymdLabel(date, withYear), title: ymdLabel(date, true) };
    for (const entry of shown) row[entry.key] = points[entry.key][date]?.hitRate;
    return row;
  });
  if (shown.length > 1) {
    return {
      ...view,
      rows,
      points,
      stats: shown.map((entry) => ({
        key: entry.key,
        label: `${entry.label} average`,
        value: rate(avgHitRate(entry.points)),
      })),
    };
  }
  const only = shown[0];
  const average = avgHitRate(only.points);
  return {
    ...view,
    rows,
    points,
    average,
    stats: [
      {
        key: 'average',
        label: only.key === SINGLE_CACHE_KEY ? 'Average hit rate' : `${only.label} average hit rate`,
        value: rate(average),
      },
      { key: 'peak', label: 'Peak', value: rate(Math.max(...only.points.map((point) => point.hitRate))) },
    ],
  };
}

export function cacheSeriesFor(
  platform: Platform,
  weekly: WeeklyData | null,
  claude: WeeklyData | null,
  codex: WeeklyData | null,
): CacheSeries[] {
  if (platform === 'both') {
    return [
      { key: 'claude', label: 'Claude', color: PLATFORM_COLORS.claude, points: claude?.cacheEfficiency ?? [] },
      { key: 'codex', label: 'Codex', color: PLATFORM_COLORS.codex, points: codex?.cacheEfficiency ?? [] },
    ];
  }
  return [{ key: SINGLE_CACHE_KEY, label: 'Cache hit rate', color: SINGLE_CACHE_COLOR, points: weekly?.cacheEfficiency ?? [] }];
}

function heatLevel(share: number): HeatLevel {
  if (share <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil(share * 4))) as HeatLevel;
}

function hourText(hour: number): string {
  if (hour === 0) return '12am';
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return '12pm';
  return `${hour - 12}pm`;
}

// Backend rows are Mon=0 .. Sun=6; the week-start preference only reorders them.
function dayOrder(weekStart: WeekStart): number[] {
  const mondayFirst = [0, 1, 2, 3, 4, 5, 6];
  return weekStart === 'sunday' ? [6, ...mondayFirst.slice(0, 6)] : mondayFirst;
}

const HOUR_LABELS = Array.from({ length: HOURS_IN_DAY }, (_, hour) => (hour % HOUR_LABEL_EVERY === 0 ? hourText(hour) : ''));

export function buildPeakHours({ grid, loading, weekStart, platform }: PeakHoursInput): PeakHoursView {
  const view: PeakHoursView = {
    title: 'Peak hours',
    description: `Effective tokens by hour and day of week over the last ${HEATMAP_DAYS} days. The range picker does not apply here.`,
    help: `Effective tokens summed into a 7-day × 24-hour grid (your local time). Darker cells are your busiest hours — when you use ${PLATFORM_NOUN[platform]} most.`,
    state: null,
    hours: HOUR_LABELS,
    rows: [],
    peak: null,
  };
  if (!grid) return { ...view, state: pending(loading, 'Could not load peak hours', 'bars', 7) };
  const max = Math.max(...grid.flat(), 1);
  let peak: { day: number; hour: number; value: number } | null = null;
  for (let day = 0; day < grid.length; day += 1) {
    for (let hour = 0; hour < grid[day].length; hour += 1) {
      const value = grid[day][hour];
      if (value > 0 && (peak === null || value > peak.value)) peak = { day, hour, value };
    }
  }
  if (!peak) {
    return {
      ...view,
      state: { kind: 'empty', title: `No usage in the last ${HEATMAP_DAYS} days`, description: USAGE_HINT[platform] },
    };
  }
  const rows = dayOrder(weekStart)
    .filter((day) => Array.isArray(grid[day]))
    .map((day) => ({
      key: WEEKDAYS_FROM_MONDAY[day],
      label: WEEKDAYS_FROM_MONDAY[day],
      cells: grid[day].map((value, hour) => ({
        key: `${day}-${hour}`,
        level: heatLevel(Math.sqrt(value / max)),
        label:
          value > 0
            ? `${WEEKDAY_NAMES_FROM_MONDAY[day]} ${hourText(hour)}: ${compact(value)} effective tokens`
            : `${WEEKDAY_NAMES_FROM_MONDAY[day]} ${hourText(hour)}: no usage`,
      })),
    }));
  return {
    ...view,
    rows,
    peak: { when: `${WEEKDAY_NAMES_FROM_MONDAY[peak.day]} at ${hourText(peak.hour)}`, tokens: compact(peak.value) },
  };
}

function dateOfKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function fullDay(key: string): string {
  return dayTitleWithYear(dateOfKey(key).getTime());
}

// Mon, Wed and Fri are labelled; the other rows stay blank.
function weekdayLabels(weekStart: WeekStart): string[] {
  const first = weekStart === 'sunday' ? 0 : 1;
  return Array.from({ length: 7 }, (_, row) => {
    const weekday = (first + row) % 7;
    return weekday % 2 === 1 ? WEEKDAYS_FROM_SUNDAY[weekday] : '';
  });
}

function activityLabel(day: DailyActivity, future: boolean): string {
  const date = fullDay(day.date);
  if (future) return `${date}: upcoming`;
  if (day.effectiveTokens === 0) return `${date}: no usage`;
  return `${date}: ${compact(day.effectiveTokens)} effective tokens, ${day.messageCount.toLocaleString()} messages, ${day.toolCallCount.toLocaleString()} tool calls`;
}

// Columns are weeks aligned to the week start and rows are weekdays; calendar days are stepped with setDate so a DST change cannot shift one.
export function buildActivityHeatmap({ days, loading, weekStart, platform, now }: ActivityHeatmapInput): ActivityHeatmapView {
  const view: ActivityHeatmapView = {
    title: 'Daily activity',
    description: `Effective tokens per day over the last ${ACTIVITY_WEEKS} weeks. The range picker does not apply here.`,
    help: `GitHub-style calendar: one square per day, darker = more effective tokens used. Shows your day-to-day ${PLATFORM_NOUN[platform]} usage streaks over the last ~${ACTIVITY_WEEKS} weeks.`,
    state: null,
    months: [],
    rows: [],
    peak: null,
  };
  if (!days) return { ...view, state: pending(loading, 'Could not load daily activity', 'bars', 7) };

  const byDate = new Map(days.map((day) => [day.date, day]));
  const max = days.reduce((top, day) => Math.max(top, day.effectiveTokens), 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayKey = localYmd(today.getTime());
  const end = new Date(today);
  const weekday = weekStart === 'sunday' ? end.getDay() : (end.getDay() + 6) % 7;
  end.setDate(end.getDate() + (6 - weekday));

  const cells: DailyActivity[] = [];
  for (let back = ACTIVITY_WEEKS * 7 - 1; back >= 0; back -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - back);
    const key = localYmd(date.getTime());
    cells.push(byDate.get(key) ?? { date: key, effectiveTokens: 0, messageCount: 0, toolCallCount: 0 });
  }

  let peak: DailyActivity | null = null;
  for (const cell of cells) {
    if (cell.effectiveTokens > 0 && (peak === null || cell.effectiveTokens > peak.effectiveTokens)) peak = cell;
  }
  if (!peak) {
    return {
      ...view,
      state: { kind: 'empty', title: `No usage in the last ${ACTIVITY_WEEKS} weeks`, description: USAGE_HINT[platform] },
    };
  }

  const months: string[] = [];
  for (let week = 0; week < ACTIVITY_WEEKS; week += 1) {
    const month = dateOfKey(cells[week * 7].date).getMonth();
    const before = week === 0 ? -1 : dateOfKey(cells[(week - 1) * 7].date).getMonth();
    months.push(month === before ? '' : MONTHS[month]);
  }

  const labels = weekdayLabels(weekStart);
  const rows: ActivityRowView[] = labels.map((label, row) => ({
    key: String(row),
    label,
    cells: Array.from({ length: ACTIVITY_WEEKS }, (_, week) => {
      const cell = cells[week * 7 + row];
      const future = cell.date > todayKey;
      return {
        key: cell.date,
        day: dateOfKey(cell.date).getDate(),
        level: future ? 0 : heatLevel(Math.sqrt(cell.effectiveTokens / Math.max(1, max))),
        future,
        tokens: cell.effectiveTokens > 0 ? compact(cell.effectiveTokens) : null,
        label: activityLabel(cell, future),
      };
    }),
  }));

  return { ...view, months, rows, peak: { when: fullDay(peak.date), tokens: compact(peak.effectiveTokens) } };
}

function dayKeyLabel(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return year && month && day ? longDateLabel(new Date(year, month - 1, day).getTime()) : key;
}

function summarySplit(summary: UsageSummaryData, fmt: (part: UsageSummary) => string): string | null {
  const parts = summary.byPlatform;
  if (!parts) return null;
  return `Claude ${parts.claude.firstEventTs == null ? '-' : fmt(parts.claude)} · Codex ${
    parts.codex.firstEventTs == null ? '-' : fmt(parts.codex)
  }`;
}

function retentionNote(platform: Platform): string {
  if (platform === 'codex') return 'It covers the Codex rollouts on this machine, from the first one.';
  const claude =
    'Claude Code deletes transcripts after ~30 days unless the history archive (DASHBOARD_RETAIN_HISTORY=1) is on, so for Claude this is the history still on disk, not the account lifetime.';
  return platform === 'both' ? `${claude} Codex covers the rollouts on this machine.` : claude;
}

// Under Both each tile adds the Claude/Codex split; under Codex and Both the lifetime tile also adds OpenAI's server-side count when it is available.
export function summaryTiles(
  summary: UsageSummaryData,
  platform: Platform,
  codexServerLifetime: number | null | undefined,
): TrendsTileView[] {
  const since = summary.firstEventTs != null ? `Since ${longDateLabel(summary.firstEventTs)}` : 'No usage yet';
  const codexLocalTotal =
    platform === 'codex'
      ? summary.lifetimeTotalTokens
      : platform === 'both'
        ? summary.byPlatform?.codex.lifetimeTotalTokens
        : undefined;
  const serverLine =
    platform !== 'claude' && codexServerLifetime != null && codexServerLifetime > 0
      ? `OpenAI ${compact(codexServerLifetime)} vs local ${compact(codexLocalTotal ?? 0)} (all tokens)`
      : null;
  const both = platform === 'both';
  const activePct = summary.spanDays > 0 ? Math.round((summary.activeDays / summary.spanDays) * 100) : 0;

  return [
    {
      key: 'lifetime',
      label: 'Lifetime tokens',
      value: compact(summary.lifetimeEffectiveTokens),
      lines: present(since, both ? summarySplit(summary, (part) => compact(part.lifetimeEffectiveTokens)) : null, serverLine),
      help: `Effective tokens (input + output + cache writes, cache reads excluded) over every usage event in the logs. ${retentionNote(platform)}${
        serverLine
          ? " OpenAI's figure is its own lifetime count for the account — every device, every token incl. cached input — so it is compared with the local all-token sum, not the effective figure."
          : ''
      }`,
      tone: 'default',
    },
    {
      key: 'peak',
      label: 'Peak day',
      value: summary.peakDay ? compact(summary.peakDay.effectiveTokens) : '-',
      lines: present(
        summary.peakDay ? dayKeyLabel(summary.peakDay.date) : null,
        both ? summarySplit(summary, (part) => (part.peakDay ? compact(part.peakDay.effectiveTokens) : '-')) : null,
      ),
      help: 'The local calendar day with the most effective tokens in the logs — the busiest day on record.',
      tone: 'default',
    },
    {
      key: 'streak',
      label: 'Current streak',
      value: `${summary.currentStreakDays}d`,
      lines: present(
        `Longest ${summary.longestStreakDays}d`,
        both ? summarySplit(summary, (part) => `${part.currentStreakDays}d`) : null,
      ),
      help: "Consecutive local calendar days with any usage, ending today (or yesterday, until today's first message). Longest is the longest such run in the logs.",
      tone: 'default',
    },
    {
      key: 'active',
      label: 'Active days',
      value: summary.activeDays.toLocaleString(),
      lines: present(
        summary.spanDays > 0 ? `Of ${summary.spanDays.toLocaleString()} days, ${activePct}%` : null,
        both ? summarySplit(summary, (part) => part.activeDays.toLocaleString()) : null,
      ),
      help: 'Local calendar days with at least one usage event, out of the days since the first one.',
      tone: 'default',
    },
  ];
}

export function buildActivitySummary({ summary, loading, platform, codexServerLifetime }: ActivitySummaryInput): ActivitySummaryView {
  if (!summary) {
    return loading
      ? { status: 'loading', tiles: [], message: null }
      : { status: 'error', tiles: [], message: { title: 'Could not load the activity summary', description: SERVER_DOWN } };
  }
  if (summary.firstEventTs == null) return { status: 'hidden', tiles: [], message: null };
  return { status: 'ready', tiles: summaryTiles(summary, platform, codexServerLifetime), message: null };
}

function successTone(percent: number): LiteLlmFactView['tone'] {
  if (percent >= SUCCESS_GOOD_PCT) return 'success';
  return percent >= SUCCESS_WARN_PCT ? 'warning' : 'danger';
}

function billedMonth(spend: LiteLlmSpend): LiteLlmMonthView {
  const previous = spend.prevMonthToDate;
  const delta = previous > 0 ? Math.round(((spend.monthToDate - previous) / previous) * 100) : null;
  const requests = spend.monthSuccessful + spend.monthFailed;
  const successPct = requests > 0 ? (spend.monthSuccessful / requests) * 100 : null;
  const facts: LiteLlmFactView[] = [
    { key: 'requests', label: 'Requests since the 1st', value: spend.monthRequests.toLocaleString(), tone: 'default' },
  ];
  if (delta !== null) {
    facts.push({
      key: 'delta',
      label: `vs ${usd(previous)} in ${spend.prevMonthLabel}, same point`,
      value: signed(delta),
      tone: 'default',
    });
  }
  if (successPct !== null) {
    facts.push({ key: 'success', label: 'Successful requests', value: rate(successPct), tone: successTone(successPct) });
  }
  if (spend.monthFailed > 0) {
    facts.push({ key: 'failed', label: 'Failed requests', value: spend.monthFailed.toLocaleString(), tone: 'default' });
  }
  if (spend.lifetime.user > 0) {
    facts.push({ key: 'lifetime', label: 'Lifetime', value: usd(spend.lifetime.user), tone: 'default' });
  }
  return { label: `${spend.monthLabel}, month to date`, value: usd(spend.monthToDate), facts };
}

function billedDays(spend: LiteLlmSpend): LiteLlmDayView[] {
  return spend.daily.map((day, index) => ({
    key: day.date,
    label: ymdLabel(day.date),
    title: dayLabel(dateOfKey(day.date).getTime()),
    cost: day.cost,
    today: index === spend.daily.length - 1,
    color: index === spend.daily.length - 1 ? BILLED_TODAY_COLOR : BILLED_COLOR,
    models: Object.entries(day.byModel)
      .filter(([, cost]) => cost > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([model, cost]) => ({ label: shortModel(model), value: usd(cost), color: modelColor(model) })),
    successful: `${day.successful.toLocaleString()} successful requests`,
  }));
}

function billedMix(spend: LiteLlmSpend): LiteLlmMixView | null {
  const tokens = spend.monthTokens;
  const total = tokens.prompt + tokens.completion + tokens.cacheRead + tokens.cacheCreate;
  if (total <= 0) return null;
  const segment = (key: keyof typeof MIX_COLORS, label: string): LiteLlmMixSegmentView => ({
    key,
    label,
    value: compact(tokens[key]),
    percent: (tokens[key] / total) * 100,
    color: MIX_COLORS[key],
  });
  return {
    label: `Token mix, ${spend.monthLabel}`,
    total: `${compact(total)} total`,
    segments: [
      segment('prompt', 'Input'),
      segment('completion', 'Output'),
      segment('cacheCreate', 'Cache write'),
      segment('cacheRead', 'Cache read'),
    ],
  };
}

export function buildLiteLlmBilled({ spend, loading, host, weekDays }: LiteLlmBilledInput): LiteLlmBilledView {
  const view: LiteLlmBilledView = {
    title: 'Actual billed',
    description: host ? `Billed by your LiteLLM gateway, ${host}` : 'Billed by your LiteLLM gateway',
    help: 'Real cost billed by your LiteLLM gateway, from its /user/daily/activity report. Month-to-date covers the 1st of the month → today; the daily view breaks out each calendar day in the selected window, including today. May exceed the estimate because the gateway also bills failed/retried requests.',
    state: null,
    month: null,
    windowLabel: rangeText(weekDays),
    windowTotal: '',
    days: [],
    truncated: null,
    mix: null,
  };
  if (!spend) {
    return {
      ...view,
      state: loading
        ? { kind: 'loading', skeleton: 'chart', rows: Math.min(weekDays, 30) }
        : {
            kind: 'error',
            title: 'Could not load the gateway bill',
            description: 'The LiteLLM gateway did not return a spend report. It keeps retrying.',
          },
    };
  }
  return {
    ...view,
    month: billedMonth(spend),
    windowTotal: `${usd(spend.daily.reduce((sum, day) => sum + day.cost, 0))} total`,
    days: billedDays(spend),
    truncated: spend.truncated
      ? 'Partial history: the gateway returned more spend rows than the dashboard pages through, so some days read low.'
      : null,
    mix: billedMix(spend),
  };
}

// Merges run from the newest end backward, so only the oldest bucket can be short: the newest always holds a full period.
export function aiTrendsPayload(data: WeeklyData | null): AiTrendsPayload | null {
  if (!data) return null;
  const slim = (bucket: Bucket): AiTrendsBucket => {
    const { byModel: _tokens, byModelCost: _cost, ...rest } = bucket;
    return { ...rest, byModelEffective: { ...(bucket.byModelEffective ?? {}) } };
  };
  if (data.buckets.length <= AI_MAX_BUCKETS) return { ...data, buckets: data.buckets.map(slim) };
  const per = Math.ceil(data.buckets.length / AI_MAX_BUCKETS);
  const buckets: AiTrendsBucket[] = [];
  for (let end = data.buckets.length; end > 0; end -= per) {
    const run = data.buckets.slice(Math.max(0, end - per), end);
    const merged: AiTrendsBucket = {
      start: run[0].start,
      byModelEffective: {},
      inputTokens: 0,
      outputTokens: 0,
      cacheCreateTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 0,
      effectiveTokens: 0,
      cost: 0,
    };
    for (const bucket of run) {
      merged.inputTokens += bucket.inputTokens;
      merged.outputTokens += bucket.outputTokens;
      merged.cacheCreateTokens += bucket.cacheCreateTokens;
      merged.cacheReadTokens += bucket.cacheReadTokens;
      merged.totalTokens += bucket.totalTokens;
      merged.effectiveTokens += bucket.effectiveTokens;
      merged.cost += bucket.cost;
      for (const [model, value] of Object.entries(bucket.byModelEffective ?? {})) {
        merged.byModelEffective[model] = (merged.byModelEffective[model] ?? 0) + value;
      }
    }
    buckets.unshift(merged);
  }
  const efficiency = data.cacheEfficiency ?? [];
  const efficiencyPer = Math.max(1, Math.ceil(efficiency.length / AI_MAX_BUCKETS));
  const cacheEfficiency: NonNullable<WeeklyData['cacheEfficiency']> = [];
  for (let end = efficiency.length; end > 0; end -= efficiencyPer) {
    const run = efficiency.slice(Math.max(0, end - efficiencyPer), end);
    const cacheReadTokens = run.reduce((sum, point) => sum + point.cacheReadTokens, 0);
    const totalTokens = run.reduce((sum, point) => sum + point.totalTokens, 0);
    cacheEfficiency.unshift({
      date: run[0].date,
      hitRate: totalTokens > 0 ? (cacheReadTokens / totalTokens) * 100 : 0,
      cacheReadTokens,
      totalTokens,
    });
  }
  return { ...data, buckets, cacheEfficiency, daysPerBucket: per };
}
