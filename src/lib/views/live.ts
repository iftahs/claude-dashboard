import type { BudgetPeriod } from '@/lib/budget';
import { PLATFORM_COLORS } from '@/lib/chart-theme';
import { buildWeeklyForecast, type ForecastTone } from '@/lib/forecast';
import { ago, compact, dateTimeLabel, shortModel, untilFull, usd } from '@/lib/format';
import {
  BLOCK_MS,
  CODEX_COVERAGE,
  DEFAULT_BLOCK_LIMIT,
  codexGaugeLive,
  codexGaugeWindow,
  formatMins,
  gaugeReading,
  isTokenExpired,
  type GaugeLive,
} from '@/lib/gauge';
import { LIMIT_DANGER_PCT, LIMIT_WARN_PCT, limitReadings, limitTone, windowName } from '@/lib/limits';
import { PLATFORM_NOUN, SURFACE_COLOR, titleScope, type Platform } from '@/lib/platform';
import type { SectionState } from '@/lib/section';
import { capViews, planLabel, resetClock, type LimitCapView } from '@/lib/views/overview';
import { nextWeekReset, startOfWeek, type WeekStart } from '@/lib/week';
import type {
  AccountLive,
  ActiveBlock,
  Bucket,
  CodexLiveData,
  CodexWindow,
  ContribRow,
  ContribWindow,
  ContributorsData,
  LimitHitEpisode,
  LimitHitsData,
  LiveExtraUsage,
  LiveSpend,
  LiveUsageData,
  LiveWeeklyBreakdown,
  RecentData,
} from '@/types';

export type LivePlatform = 'claude' | 'codex';
export type LiveTone = 'accent' | 'warning' | 'danger';
export type LiveMeterTone = LiveTone | 'neutral';
export type LiveValueTone = 'default' | 'warning' | 'danger';

export interface LiveNoticeView {
  title: string;
  description: string;
}

export interface LimitGaugeBadgeView {
  label: string;
  tone: 'success' | 'warning' | 'neutral';
  live: boolean;
}

export interface LimitGaugeMeterView {
  label: string;
  percent: number;
  tone: LiveMeterTone;
  caption: string | null;
}

export interface LimitGaugeRowView {
  key: string;
  label: string;
  value: string;
  tone: LiveValueTone;
  help: string | null;
}

export interface LimitGaugeView {
  platform: LivePlatform;
  title: string;
  description: string | null;
  help: string;
  state: SectionState | null;
  badge: LimitGaugeBadgeView | null;
  value: string;
  caption: string;
  meter: LimitGaugeMeterView | null;
  rowsLabel: string;
  rows: LimitGaugeRowView[];
  notice: LiveNoticeView | null;
  source: string;
  hint: string | null;
}

export type AlertPermission = 'ask' | 'blocked';

interface GaugeInputBase {
  named: boolean;
  block: ActiveBlock | null;
  loading: boolean;
  failed: boolean;
  isApi: boolean;
  costPerDay: number;
  dailyLimit: number | null;
  permission: AlertPermission | null;
  now: number;
}

export interface ClaudeGaugeInput extends GaugeInputBase {
  live: LiveUsageData | null;
  todayActualCost: number | null;
}

export interface CodexGaugeInput extends GaugeInputBase {
  live: CodexLiveData | null;
  liveFailed: string | null;
  windowSec: number | null;
}

export interface HourlyUsageView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  buckets: Bucket[];
}

export interface HourlyUsageInput {
  recent: RecentData | null;
  loading: boolean;
  failed: boolean;
  hours: number;
  platform: Platform;
  coworkOnly: boolean;
}

export interface PlanLimitForecastView {
  label: string;
  tone: ForecastTone;
  willExceed: boolean;
}

export interface PlanSurfaceView {
  key: string;
  label: string;
  percent: number;
  color: string;
}

export interface PlanLimitRowView {
  key: string;
  label: string;
  value: string;
  percent: number;
  tone: LiveTone;
  note: string;
  forecast: PlanLimitForecastView | null;
  surfaces: PlanSurfaceView[];
}

export interface PlanGateView {
  key: string;
  label: string;
  status: string;
  tone: 'success' | 'muted' | 'danger';
}

export interface PlanLimitsView {
  key: string;
  platform: LivePlatform;
  title: string;
  account: string | null;
  plan: string | null;
  active: boolean;
  help: string;
  state: SectionState | null;
  rows: PlanLimitRowView[];
  gates: PlanGateView[];
  note: string | null;
}

export interface ClaudePlansInput {
  accounts: AccountLive[];
  live: LiveUsageData | null;
  liveLoading: boolean;
  block: ActiveBlock | null;
  weeklyEffective: number | null;
  plan: string | null | undefined;
  weekStart: WeekStart;
  now: number;
}

export interface CodexPlanInput {
  live: CodexLiveData | null;
  failed: string | null;
  weekStart: WeekStart;
  now: number;
}

export interface ExtraUsageRowView {
  label: string;
  value: string;
  tone?: 'danger';
}

export interface ExtraUsageHeadlineView {
  label: string;
  value: string;
  limit: string | null;
  pct: number | null;
  tone: LiveTone;
}

export interface ExtraUsageDisclaimerView {
  text: string;
  linkText: string | null;
  href: string | null;
}

export interface ExtraUsageView {
  platform: LivePlatform;
  title: string;
  help: string;
  enabled: boolean;
  usage?: ExtraUsageHeadlineView;
  disabledCopy?: string;
  rows?: ExtraUsageRowView[];
  disclaimer?: ExtraUsageDisclaimerView;
}

export type ContribRange = 'day' | 'week';
export type ContribBreakdownKey = keyof Pick<ContribWindow, 'skills' | 'subagents' | 'plugins' | 'mcpServers'>;

export interface ContribRangeOption {
  value: ContribRange;
  label: string;
}

export interface ContribBehaviorView {
  key: string;
  headline: string;
  body: string;
}

export interface ContribShareView {
  name: string;
  percent: number;
}

export interface ContribBreakdownView {
  key: ContribBreakdownKey;
  label: string;
  rows: ContribShareView[];
}

export interface LimitContributorsView {
  key: string;
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  range: ContribRange;
  behaviors: ContribBehaviorView[];
  breakdowns: ContribBreakdownView[];
}

export interface ContributorsInput {
  key: string;
  codex: boolean;
  scope: string;
  data: ContributorsData | null;
  failed: boolean;
  range: ContribRange;
}

export interface LimitHitsFigureView {
  key: string;
  label: string;
  value: string;
  note: string;
  alert: boolean;
}

export interface LimitHitPlatformView {
  label: string;
  color: string;
}

export interface LimitHitRowView {
  key: string;
  when: string;
  kind: string;
  model: string | null;
  platform: LimitHitPlatformView | null;
  status: string;
  active: boolean;
}

export interface LimitHitsView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  blocked: boolean;
  figures: LimitHitsFigureView[];
  rows: LimitHitRowView[];
}

export interface LimitHitsInput {
  data: LimitHitsData | null;
  failed: boolean;
  platform: Platform;
  now: number;
}

export interface SpendCapsView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  rows: LimitCapView[];
}

export interface SpendCapsInput {
  platform: Platform;
  budget: BudgetPeriod[] | null;
  failed: boolean;
  apiMode: boolean;
  hasCaps: boolean;
  actualNote: string | null;
  now: number;
}

export const LIMIT_HIT_ROWS = 6;
export const RECENT_HOUR_OPTIONS: readonly number[] = [5, 12, 24, 48];
export const CONTRIB_RANGE_OPTIONS: readonly ContribRangeOption[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const DEFAULT_WEEKLY_LIMIT = 35_000_000;
const SERVER_DOWN = 'The dashboard server did not answer. It keeps retrying.';
const NEXT_MESSAGE = 'Opens with your next message';
const PAUSES = 'usage pauses at your plan limit until the next reset.';

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function toneFor(percent: number): LiveTone {
  const tone = limitTone(percent);
  return tone === 'success' ? 'accent' : tone;
}

function estimate(amount: number): string {
  return `~${amount > 0 ? usd(amount) : '$0.00'}`;
}

function windowClock(ms: number, now: number): string {
  const date = new Date(ms);
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (Math.abs(ms - now) < DAY_MS) return time;
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
}

interface GaugeStatus {
  badge: LimitGaugeBadgeView;
  source: string;
  notice: LiveNoticeView | null;
}

interface GaugeCopy {
  platform: LivePlatform;
  title: string;
  help: string;
  rowsLabel: string;
  previous: string;
  tokensHelp: string;
}

interface GaugeCore extends GaugeInputBase {
  live: GaugeLive | null;
  todayActualCost: number | null;
  blockLimit: number | null;
  windowMs: number;
}

const CLAUDE_GAUGE_HELP =
  "The percentage is the live share of your account's 5-hour limit from Claude.ai (every device). The rows cover the current 5-hour block of your most recent Claude Code session, from local logs: a block opens at its first message, and the first message after it ends opens the next (how Anthropic starts a 5-hour window). Tokens are effective tokens (input, output and cache writes). The limit estimate extrapolates the live percentage at its average pace since the window opened.";
const CLAUDE_GAUGE_API_HELP =
  "Estimated cost of your current 5-hour usage block in your most recent session: a window opens at its first message, and the first message after it ends opens the next. Dollar figures use Anthropic's published API rates and are computed from local logs. The bar fills against your daily spending cap when one is set in Settings.";
const CLAUDE_GAUGE_GATEWAY_HELP =
  'The big number is the estimated cost of your current 5-hour block (published API rates, from local logs). The daily cap bar uses your real billed spend so far today from your LiteLLM gateway. See Spend vs caps below for the real today, week and month figures. Set a daily cap in Settings.';
const ESTIMATED_BLOCK = 'Estimated against a rough guide of 6M effective tokens per 5 hours.';
const CLAUDE_TOKENS_HELP = 'Input, output and cache writes. Cache reads do not count toward limits.';
const CODEX_TOKENS_HELP = 'Input and output. Cached input does not count toward limits.';
const CODEX_EXPIRED =
  'Open the ChatGPT desktop app once. It refreshes its own token and this card recovers on the next poll. The dashboard never refreshes tokens itself.';

function permissionHint(permission: AlertPermission | null, isApi: boolean): string | null {
  if (isApi || !permission) return null;
  return permission === 'blocked'
    ? 'Limit alerts are blocked by your browser.'
    : 'Allow notifications in your browser to get limit alerts.';
}

function gaugeView(copy: GaugeCopy, status: GaugeStatus, core: GaugeCore): LimitGaugeView {
  const base = {
    platform: copy.platform,
    title: copy.title,
    help: copy.help,
    rowsLabel: copy.rowsLabel,
    badge: status.badge,
    notice: status.notice,
    source: status.source,
    hint: permissionHint(core.permission, core.isApi),
  };
  const blank = { description: null, value: '', caption: '', meter: null, rows: [] };

  if (!core.block && core.loading) {
    return { ...base, ...blank, badge: null, notice: null, state: { kind: 'loading', skeleton: 'gauge', rows: 2 } };
  }
  if (!core.block && !core.live && core.failed) {
    return {
      ...base,
      ...blank,
      badge: null,
      notice: null,
      state: { kind: 'error', title: 'Could not load the current window', description: SERVER_DOWN },
    };
  }

  const { now, isApi } = core;
  const reading = gaugeReading({
    block: core.block,
    live: core.live,
    isApi,
    costPerDay: core.costPerDay,
    dailyLimit: core.dailyLimit,
    todayActualCost: core.todayActualCost,
    blockLimit: core.blockLimit,
    windowMs: core.windowMs,
    now,
  });

  const left = reading.noActiveBlock ? NEXT_MESSAGE.toLowerCase() : `${untilFull(reading.resetsAt)} left`;
  const description = reading.noActiveBlock
    ? NEXT_MESSAGE
    : reading.startsAt !== null
      ? `Started ${windowClock(reading.startsAt, now)}, resets ${windowClock(reading.resetsAt, now)}`
      : `Resets ${windowClock(reading.resetsAt, now)}`;

  let value: string;
  let caption: string;
  let meter: LimitGaugeMeterView | null;
  if (isApi) {
    value = estimate(reading.cost);
    caption = `est. cost, ${left}`;
    meter =
      reading.capPct === null
        ? null
        : {
            label: 'Daily cap',
            percent: reading.capPct,
            tone: toneFor(reading.capPct),
            caption: `${reading.capPct.toFixed(0)}% of your daily cap, ${core.todayActualCost !== null ? 'from real gateway spend today' : 'at your average est. spend per day'}`,
          };
  } else if (reading.tokPct === null) {
    value = compact(reading.effective);
    caption = 'effective tokens, limit unknown';
    meter = { label: copy.title, percent: 0, tone: 'neutral', caption: null };
  } else {
    value = `${reading.tokPct.toFixed(0)}%`;
    caption =
      reading.hasLive && reading.tokPct >= 100 && !reading.noActiveBlock
        ? `used, limit reached, resets in ${untilFull(reading.resetsAt)}`
        : `used, ${left}`;
    meter = {
      label: copy.title,
      percent: reading.tokPct,
      tone: toneFor(reading.tokPct),
      caption: reading.hasLive ? null : ESTIMATED_BLOCK,
    };
  }

  const rows: LimitGaugeRowView[] = [
    { key: 'tokens', label: 'Effective tokens', value: compact(reading.effective), tone: 'default', help: copy.tokensHelp },
  ];
  if (!isApi) rows.push({ key: 'cost', label: 'Est. cost', value: estimate(reading.cost), tone: 'default', help: null });
  if (isApi ? reading.prevCost > 0 : reading.prevEffective > 0) {
    rows.push({
      key: 'previous',
      label: copy.previous,
      value: isApi ? estimate(reading.prevCost) : compact(reading.prevEffective),
      tone: 'default',
      help: null,
    });
  }
  rows.push({ key: 'cache', label: 'Cache reads', value: compact(reading.cacheReads), tone: 'default', help: null });
  const burn = isApi
    ? reading.burnCostPerHour > 0
      ? `${usd(reading.burnCostPerHour)} / hr`
      : null
    : reading.burnRatePerHour > 0
      ? `${compact(reading.burnRatePerHour)} / hr`
      : null;
  if (burn) rows.push({ key: 'burn', label: 'Burn rate', value: burn, tone: 'default', help: null });
  if (!isApi && (reading.tokPct ?? 0) < 100) {
    if (reading.minsUntilLimit !== null) {
      rows.push({
        key: 'eta',
        label: 'Limit reached in',
        value: formatMins(reading.minsUntilLimit),
        tone: reading.paceTone === 'neutral' ? 'default' : reading.paceTone,
        help: null,
      });
    } else if (reading.projectedPct !== null && reading.hasLive) {
      rows.push({
        key: 'eta',
        label: 'Projected at reset',
        value: `~${Math.round(reading.projectedPct)}%`,
        tone: 'default',
        help: null,
      });
    }
  }

  if (!core.block && core.failed) {
    return {
      ...base,
      state: null,
      description,
      value,
      caption,
      meter,
      rows: [],
      notice: base.notice ?? { title: 'Local usage could not be loaded', description: SERVER_DOWN },
    };
  }

  return { ...base, state: null, description, value, caption, meter, rows };
}

export function buildClaudeGauge(input: ClaudeGaugeInput): LimitGaugeView {
  const { isApi } = input;
  const usable = input.live && !input.live.error && input.live.five_hour ? input.live : null;
  const live: GaugeLive | null = usable ? { pct: usable.five_hour.utilization, resetsAt: usable.five_hour.resets_at } : null;
  const liveError = input.live?.error ?? null;
  const gateway = input.todayActualCost !== null;

  let status: GaugeStatus;
  if (isApi) {
    status = {
      badge: { label: 'Estimated', tone: 'neutral', live: false },
      source: gateway
        ? 'The 5-hour block is estimated from local logs. The daily cap bar uses real spend from your gateway.'
        : 'Current 5-hour session, estimated from local logs.',
      notice: null,
    };
  } else if (live) {
    status = { badge: { label: 'Live', tone: 'success', live: true }, source: 'Live from Claude.ai, across every device.', notice: null };
  } else if (liveError) {
    const expired = isTokenExpired(liveError);
    status = {
      badge: { label: expired ? 'Expired' : 'Offline', tone: 'warning', live: false },
      source: 'Showing local logs only.',
      notice: { title: expired ? 'Claude.ai token expired' : 'Claude live limits unavailable', description: liveError },
    };
  } else {
    status = {
      badge: { label: 'Connecting', tone: 'neutral', live: false },
      source: 'Showing local logs while connecting to Claude.ai.',
      notice: null,
    };
  }

  const copy: GaugeCopy = {
    platform: 'claude',
    title: sentence(`${input.named ? 'Claude ' : ''}${isApi ? 'spend this block' : '5-hour window'}`),
    help: isApi ? (gateway ? CLAUDE_GAUGE_GATEWAY_HELP : CLAUDE_GAUGE_API_HELP) : CLAUDE_GAUGE_HELP,
    rowsLabel: 'This session, from local logs',
    previous: 'Previous session',
    tokensHelp: CLAUDE_TOKENS_HELP,
  };

  return gaugeView(copy, status, { ...input, live, blockLimit: DEFAULT_BLOCK_LIMIT, windowMs: BLOCK_MS });
}

function snapshotAge(live: CodexLiveData): string {
  const at = live.snapshotAt ? Date.parse(live.snapshotAt) : NaN;
  return Number.isNaN(at) ? 'Snapshot of unknown age' : `Snapshot from ${ago(at)}`;
}

export function buildCodexGauge(input: CodexGaugeInput): LimitGaugeView {
  const { isApi } = input;
  const window = codexGaugeWindow(input.live);
  const reading = codexGaugeLive(input.live);
  const exhausted =
    !!input.live && !!window && codexReached(input.live).has(window === input.live.fiveHour ? 'codex-5h' : 'codex-weekly');
  const live = reading && exhausted ? { ...reading, pct: 100 } : reading;
  const liveError = input.live?.error ?? input.liveFailed;
  const windowSec = input.windowSec ?? window?.windowSec ?? BLOCK_MS / 1000;
  const name = windowName(windowSec);
  const passive = !!input.live && !input.live.error && input.live.origin === 'passive';

  let status: GaugeStatus;
  if (isApi) {
    status = {
      badge: { label: 'API key', tone: 'neutral', live: false },
      source: 'Signed in with an API key. Estimated from local rollouts.',
      notice: null,
    };
  } else if (live && input.live) {
    status = passive
      ? {
          badge: { label: 'Snapshot', tone: 'warning', live: false },
          source: `${snapshotAge(input.live)}, from the newest local rollout.`,
          notice: null,
        }
      : { badge: { label: 'Live', tone: 'success', live: true }, source: 'Live from ChatGPT.', notice: null };
  } else if (liveError) {
    const expired = isTokenExpired(liveError);
    status = {
      badge: { label: expired ? 'Expired' : 'Offline', tone: 'warning', live: false },
      source: 'Showing local rollouts only.',
      notice: expired
        ? { title: 'Codex token expired', description: CODEX_EXPIRED }
        : { title: 'Codex live limits unavailable', description: liveError },
    };
  } else {
    status = {
      badge: { label: 'Connecting', tone: 'neutral', live: false },
      source: 'Showing local rollouts while connecting to ChatGPT.',
      notice: null,
    };
  }

  const copy: GaugeCopy = {
    platform: 'codex',
    title: sentence(`${input.named ? 'Codex ' : ''}${isApi ? `spend this ${name} window` : `${name} window`}`),
    help: isApi
      ? `Estimated cost of your Codex usage in the current ${name} window, at OpenAI's list API prices, from local rollouts. You are signed in with an API key, so there are no plan windows. The bar fills against your daily spending cap when one is set in Settings.`
      : `The percentage is the live share of your ChatGPT plan's ${name} Codex window, from OpenAI's usage API (offline: the newest local rollout snapshot). The rows count this window's effective tokens (input and output) on this machine; the previous window is the equally long stretch before it. The limit estimate extrapolates the live percentage at its average pace since the window opened. ${CODEX_COVERAGE}`,
    rowsLabel: 'This window, on this machine',
    previous: 'Previous window',
    tokensHelp: CODEX_TOKENS_HELP,
  };

  return gaugeView(copy, status, { ...input, live, todayActualCost: null, blockLimit: null, windowMs: windowSec * 1000 });
}

const HOURLY_HINT: Record<Platform, string> = {
  claude: 'Use Claude Code and the hours fill in.',
  codex: 'Run a thread in the ChatGPT desktop app and the hours fill in.',
  both: 'Use Claude Code or Codex and the hours fill in.',
};

export function buildHourly({ recent, loading, failed, hours, platform, coworkOnly }: HourlyUsageInput): HourlyUsageView {
  const counted = platform === 'codex' ? CODEX_TOKENS_HELP : CLAUDE_TOKENS_HELP;
  const view: HourlyUsageView = {
    title: 'Effective tokens per hour',
    description: `Last ${hours} hours, by model`,
    help: `Tokens used per hour over the recent window, stacked by model. ${counted} Change the window with the picker at the top of the page (5 to 48 hours).`,
    state: null,
    buckets: recent?.buckets ?? [],
  };
  if (!recent) {
    const state: SectionState =
      failed && !loading
        ? { kind: 'error', title: 'Could not load hourly usage', description: SERVER_DOWN }
        : { kind: 'loading', skeleton: 'chart', rows: Math.min(hours, 24) };
    return { ...view, state };
  }
  if (recent.totals.totalTokens === 0) {
    return {
      ...view,
      state: {
        kind: 'empty',
        title: `No usage in the last ${hours} hours`,
        description: coworkOnly ? 'Use Cowork and the hours fill in.' : HOURLY_HINT[platform],
      },
    };
  }
  return view;
}

interface PlanWindow {
  utilization: number;
  resetsAt: string | null;
}

interface PlanScopedWindow extends PlanWindow {
  label: string;
}

interface PlanSource {
  fiveHour: PlanWindow | null;
  weekly: PlanWindow | null;
  scoped: PlanScopedWindow[];
  breakdown: LiveWeeklyBreakdown | null;
}

interface PlanLabels {
  block: string;
  weekly: string;
}

interface PlanRowsInput {
  source: PlanSource | null;
  labels: PlanLabels;
  block: ActiveBlock | null;
  weeklyEffective: number | null;
  weekStart: WeekStart;
  now: number;
}

const CLAUDE_PLAN_HELP =
  "Your live subscription rate-limit ceilings from Claude.ai: the 5-hour window plus the weekly all-models, per-model and Cowork caps, each with the share used and the time to reset. Pulled from Anthropic's usage API. These are surfaced for awareness, not enforced.";
const CODEX_PLAN_HELP = `Your ChatGPT plan's Codex rate-limit windows: the 5-hour window and the weekly window, each with the share used and the time to reset, plus any premium model the plan gates separately. Read from OpenAI's usage API with the token the ChatGPT desktop app stores locally. Surfaced for awareness, never enforced or refreshed by this dashboard. ${CODEX_COVERAGE}`;
const CLAUDE_PLAN_TITLE = 'Claude plan limits';
const CLAUDE_PLAN_LABELS: PlanLabels = { block: '5-hour limit', weekly: 'Weekly limit, all models' };
const CODEX_PLAN_LABELS: PlanLabels = { block: '5-hour limit', weekly: 'Weekly limit' };
const OFFLINE_PLAN_NOTE =
  'Live limits are unavailable. These bars are estimated from local logs against a rough guide of 6M effective tokens per 5 hours and 35M per week.';
export const PLAN_SURFACE_HELP =
  'Where the weekly usage so far came from, by surface. The shares add up to 100% of what you have used this week, not of the weekly limit.';
const SURFACE_COLORS: Record<string, string> = {
  claude_code: SURFACE_COLOR.code,
  cowork: SURFACE_COLOR.cowork,
  chat: SURFACE_COLOR.chat,
};
const OTHER_SURFACE_COLOR = SURFACE_COLOR.other;
const SURFACE_LABELS: Record<string, string> = {
  claude_code: 'Claude Code',
  cowork: 'Cowork',
  chat: 'Chats',
  other: 'Other',
};

function surfaceSegments(breakdown: LiveWeeklyBreakdown | null): PlanSurfaceView[] {
  if (!breakdown || !Array.isArray(breakdown.rows)) return [];
  const rows = breakdown.rows.filter((row) => typeof row.percent === 'number' && row.percent > 0);
  const total = rows.reduce((sum, row) => sum + row.percent, 0);
  if (total <= 0) return [];
  return rows.map((row) => ({
    key: row.key,
    label: row.display_name || SURFACE_LABELS[row.key] || row.key.replace(/_/g, ' '),
    percent: (row.percent / total) * 100,
    color: SURFACE_COLORS[row.key] ?? OTHER_SURFACE_COLOR,
  }));
}

function resetNote(resetsAt: number | null, now: number): string {
  return resetsAt === null ? NEXT_MESSAGE : `Resets in ${untilFull(resetsAt)}, ${resetClock(resetsAt, now)}`;
}

function parseReset(iso: string | null | undefined): number | null {
  const at = Date.parse(iso ?? '');
  return Number.isNaN(at) ? null : at;
}

function meterRow(key: string, label: string, percent: number, note: string, live: boolean): PlanLimitRowView {
  const reached = live && percent >= 100 && note !== NEXT_MESSAGE;
  return {
    key,
    label,
    value: `${percent}%`,
    percent,
    tone: toneFor(percent),
    note: reached ? `Limit reached. ${note}` : note,
    forecast: null,
    surfaces: [],
  };
}

function planRows({ source, labels, block, weeklyEffective, weekStart, now }: PlanRowsInput): PlanLimitRowView[] {
  const rows: PlanLimitRowView[] = [];

  if (!source || source.fiveHour) {
    const blockEnded = !source && (!block || !block.isActive || block.resetsAt <= now);
    const percent = source
      ? Math.round(source.fiveHour?.utilization ?? 0)
      : blockEnded
        ? 0
        : Math.min(100, Math.round(((block?.totals.effectiveTokens ?? 0) / DEFAULT_BLOCK_LIMIT) * 100));
    const liveReset = source ? parseReset(source.fiveHour?.resetsAt) : null;
    const idle = source ? source.fiveHour?.resetsAt == null : blockEnded;
    const resetsAt = liveReset ?? block?.resetsAt ?? now + BLOCK_MS;
    rows.push(meterRow('block', labels.block, percent, resetNote(idle ? null : resetsAt, now), !!source));
  }

  if (!source || source.weekly) {
    const raw = source
      ? (source.weekly?.utilization ?? 0)
      : Math.min(100, ((weeklyEffective ?? 0) / DEFAULT_WEEKLY_LIMIT) * 100);
    const liveReset = source ? parseReset(source.weekly?.resetsAt) : null;
    const idle = !!source && source.weekly?.resetsAt == null;
    const resetsAt = liveReset ?? nextWeekReset(now, weekStart);
    const windowStart = liveReset !== null ? liveReset - WEEK_MS : startOfWeek(now, weekStart);
    const forecast = idle ? null : buildWeeklyForecast({ pct: raw, windowStart, resetsAt, now });
    rows.push({
      ...meterRow('weekly', labels.weekly, Math.round(raw), resetNote(idle ? null : resetsAt, now), !!source),
      forecast: forecast
        ? { label: sentence(forecast.label.replace(' · ', ', ')), tone: forecast.tone, willExceed: forecast.willExceed }
        : null,
      surfaces: source ? surfaceSegments(source.breakdown) : [],
    });
  }

  for (const scoped of source?.scoped ?? []) {
    const resetsAt = parseReset(scoped.resetsAt);
    const note = scoped.resetsAt == null ? NEXT_MESSAGE : resetsAt === null ? 'Reset time unknown' : resetNote(resetsAt, now);
    rows.push(meterRow(scoped.label, scoped.label, Math.round(scoped.utilization), note, true));
  }

  return rows;
}

function claudeSource(live: LiveUsageData): PlanSource {
  const scoped: PlanScopedWindow[] = (live.limits ?? [])
    .filter((limit) => limit.group === 'weekly' && limit.kind === 'weekly_scoped' && limit.scope?.model?.display_name)
    .map((limit) => ({
      label: `Weekly limit, ${limit.scope?.model?.display_name ?? ''}`,
      utilization: limit.percent,
      resetsAt: limit.resets_at,
    }));
  const legacy: PlanScopedWindow[] = (
    [
      ['Sonnet', live.seven_day_sonnet],
      ['Opus', live.seven_day_opus],
      ['Cowork', live.seven_day_cowork],
    ] as const
  ).flatMap(([name, info]) =>
    info ? [{ label: `Weekly limit, ${name}`, utilization: info.utilization, resetsAt: info.resets_at ?? null }] : [],
  );
  const window = (info: LiveUsageData['five_hour'] | null | undefined): PlanWindow | null =>
    info ? { utilization: info.utilization, resetsAt: info.resets_at ?? null } : null;
  return {
    fiveHour: window(live.five_hour),
    weekly: window(live.seven_day),
    scoped: scoped.length ? scoped : legacy,
    breakdown: live.seven_day_breakdown ?? null,
  };
}

// The provider's limitReached flag marks its fullest open window as exhausted, whatever its % reads (same rule as the topbar chip).
function codexReached(live: CodexLiveData): Set<string> {
  return new Set(
    limitReadings(null, live)
      .filter((reading) => reading.reached)
      .map((reading) => reading.key),
  );
}

function codexSource(live: CodexLiveData): PlanSource {
  const reached = codexReached(live);
  const window = (key: string, info: CodexWindow | null): PlanWindow | null =>
    info ? { utilization: reached.has(key) ? 100 : info.usedPct, resetsAt: info.resetsAt } : null;
  return {
    fiveHour: window('codex-5h', live.fiveHour),
    weekly: window('codex-weekly', live.weekly),
    scoped: [],
    breakdown: null,
  };
}

function codexGates(live: CodexLiveData): PlanGateView[] {
  return Object.entries(live.modelAvailability ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, available]) => ({
      key: slug,
      label: `Premium, ${slug}`,
      status: available ? 'Available' : live.limitReached ? 'Paused, plan limit reached' : 'Not available right now',
      tone: available ? 'success' : live.limitReached ? 'danger' : 'muted',
    }));
}

function codexSnapshotNote(live: CodexLiveData): string {
  const why = live.warning ? ` ${sentence(live.warning)}.` : '';
  return `${snapshotAge(live)}, from the newest local rollout. Open the ChatGPT app for live numbers.${why}`;
}

type PlanCardBase = Pick<PlanLimitsView, 'key' | 'platform' | 'title' | 'plan' | 'active' | 'help'>;

function planCard(base: PlanCardBase, rest: Partial<PlanLimitsView>): PlanLimitsView {
  return { ...base, account: null, state: null, rows: [], gates: [], note: null, ...rest };
}

export function buildClaudePlans({
  accounts,
  live,
  liveLoading,
  block,
  weeklyEffective,
  plan,
  weekStart,
  now,
}: ClaudePlansInput): PlanLimitsView[] {
  const labels = CLAUDE_PLAN_LABELS;
  if (accounts.length > 1) {
    return accounts.map((account) => {
      const base: PlanCardBase = {
        key: account.key,
        platform: 'claude',
        title: CLAUDE_PLAN_TITLE,
        plan: planLabel(account.subscriptionType ?? account.rateLimitTier),
        active: account.isActive,
        help: CLAUDE_PLAN_HELP,
      };
      if (account.live.error) {
        return planCard(base, {
          account: account.label,
          state: {
            kind: 'empty',
            icon: 'alert',
            title: isTokenExpired(account.live.error) ? 'Token expired for this account' : 'Live limits unavailable for this account',
            description: account.live.error,
          },
        });
      }
      return planCard(base, {
        account: account.label,
        rows: planRows({ source: claudeSource(account.live), labels, block: null, weeklyEffective: null, weekStart, now }),
      });
    });
  }

  const base: PlanCardBase = {
    key: 'claude',
    platform: 'claude',
    title: CLAUDE_PLAN_TITLE,
    plan: planLabel(plan),
    active: false,
    help: CLAUDE_PLAN_HELP,
  };
  if (!live && liveLoading) return [planCard(base, { state: { kind: 'loading', skeleton: 'bars', rows: 2 } })];
  const source = live && !live.error ? claudeSource(live) : null;
  return [
    planCard(base, {
      rows: planRows({ source, labels, block, weeklyEffective, weekStart, now }),
      note: source ? null : OFFLINE_PLAN_NOTE,
    }),
  ];
}

export function buildCodexPlan({ live, failed, weekStart, now }: CodexPlanInput): PlanLimitsView {
  const usable = live && !live.error ? live : null;
  const base: PlanCardBase = {
    key: 'codex',
    platform: 'codex',
    title: 'Codex plan limits',
    plan: planLabel(usable?.planType),
    active: false,
    help: CODEX_PLAN_HELP,
  };
  if (usable) {
    return planCard(base, {
      rows: planRows({ source: codexSource(usable), labels: CODEX_PLAN_LABELS, block: null, weeklyEffective: null, weekStart, now }),
      gates: codexGates(usable),
      note: usable.origin === 'passive' ? codexSnapshotNote(usable) : null,
    });
  }
  const error = live?.error ?? failed;
  if (error) {
    const expired = isTokenExpired(error);
    return planCard(base, {
      state: {
        kind: 'empty',
        icon: 'alert',
        title: expired ? 'Codex token expired' : 'Codex live limits unavailable',
        description: expired ? CODEX_EXPIRED : error,
      },
    });
  }
  return planCard(base, { state: { kind: 'loading', skeleton: 'bars', rows: 2 } });
}

export function toMajorUnits(amountMinor: number | null | undefined, exponent: number | null | undefined): number | null {
  if (amountMinor == null) return null;
  return amountMinor / Math.pow(10, exponent ?? 2);
}

const DISABLED_REASON_LABELS: Record<string, string> = {
  out_of_credits: "Your organization's pre-purchased usage credits have run out.",
};

export function disabledReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return DISABLED_REASON_LABELS[reason] ?? reason.replace(/_/g, ' ');
}

// Anthropic sends `disclaimer` as plain text with an optional trailing `[label](url)` markdown link.
export function parseDisclaimer(disclaimer: string | null | undefined): ExtraUsageDisclaimerView {
  if (!disclaimer) return { text: '', linkText: null, href: null };
  const match = /\[([^\]]+)\]\(([^)]+)\)/.exec(disclaimer);
  if (!match) return { text: disclaimer, linkText: null, href: null };
  const safe = /^https?:\/\//i.test(match[2]);
  return { text: disclaimer.slice(0, match.index).trim(), linkText: safe ? match[1] : null, href: safe ? match[2] : null };
}

// disabledCopy precedence: user opt-out, then an org-level reason, then org never enabled.
export function claudeExtraUsageView(extraUsage: LiveExtraUsage, spend: LiveSpend | null | undefined, orgEnabled: boolean): ExtraUsageView {
  const used = toMajorUnits(extraUsage.used_credits, extraUsage.decimal_places);
  const limit = toMajorUnits(extraUsage.monthly_limit, extraUsage.decimal_places);
  const pct = extraUsage.utilization != null
    ? Math.round(extraUsage.utilization)
    : limit ? Math.round(((used ?? 0) / limit) * 100) : null;
  const disabledCopy = extraUsage.user_disabled
    ? `You turned extra usage off, so ${PAUSES}`
    : orgEnabled
      ? (disabledReasonLabel(extraUsage.disabled_reason) ?? `Not currently available, so ${PAUSES}`)
      : `Your organization has not enabled extra usage, so ${PAUSES}`;
  const disclaimer = parseDisclaimer(spend?.disclaimer);
  return {
    platform: 'claude',
    title: 'Extra usage',
    help: "Once you hit your plan's included limit, extra usage bills at standard API rates from your organization's pre-purchased credit pool (if your admin has enabled it).",
    enabled: extraUsage.is_enabled,
    usage: {
      label: 'This month',
      value: used != null ? usd(used) : 'Not reported',
      limit: limit != null ? usd(limit) : null,
      pct,
      tone: toneFor(pct ?? 0),
    },
    disabledCopy,
    disclaimer: disclaimer.text || disclaimer.linkText ? disclaimer : undefined,
  };
}

// Null when the payload has neither purchased credits nor reset credits.
export function codexCreditsView(live: CodexLiveData): ExtraUsageView | null {
  const c = live.credits;
  const rc = live.resetCredits;
  if (!c && !rc) return null;
  const enabled = !!c && (c.hasCredits || c.unlimited);
  const rows: ExtraUsageRowView[] = [];
  if (rc) {
    rows.push({ label: 'Reset credits', value: `${rc.available} available` });
    rows.push({ label: 'Applicable now', value: String(rc.applicable) });
  }
  if (c?.overageLimitReached) rows.push({ label: 'Overage limit', value: 'Reached', tone: 'danger' });
  return {
    platform: 'codex',
    title: 'Credits',
    help: 'ChatGPT credits keep Codex running once a plan window is exhausted, billed per use. Reset credits clear a rate-limit window early; "applicable now" counts the ones the current window accepts.',
    enabled,
    usage: { label: 'Balance', value: c?.unlimited ? 'Unlimited' : (c?.balance ?? 'Not reported'), limit: null, pct: null, tone: 'accent' },
    disabledCopy: c ? `No credits on this account, so ${PAUSES}` : 'Credits not reported for this plan.',
    rows,
  };
}

const CONTRIB_BREAKDOWNS: readonly { key: ContribBreakdownKey; label: string }[] = [
  { key: 'skills', label: 'Skills' },
  { key: 'subagents', label: 'Subagents' },
  { key: 'plugins', label: 'Plugins' },
  { key: 'mcpServers', label: 'MCP servers' },
];
const CONTRIB_CLAUDE_HELP =
  'Approximate, cost-weighted breakdown computed from local sessions on this machine. It does not include other devices or claude.ai. These are independent characteristics of your usage, not a breakdown that adds up to 100%. Mirrors the Claude Code CLI usage view.';
const CONTRIB_CODEX_HELP =
  'Approximate breakdown of your Codex usage, weighted by effective tokens (Guardian auto-reviews are priced at $0, so a cost weighting would hide them), computed from local rollouts on this machine. It does not include the ChatGPT mobile or web apps. These are independent characteristics of your usage, not a breakdown that adds up to 100%.';
const AGENT_NAMES: Record<string, string> = {
  guardian_review: 'Guardian auto-review',
};

function windowIsEmpty(window: ContribWindow): boolean {
  return !window.behaviors.length && !CONTRIB_BREAKDOWNS.some(({ key }) => window[key].length);
}

function shareRows(rows: ContribRow[], key: ContribBreakdownKey): ContribShareView[] {
  return rows.map((row) => ({ name: key === 'subagents' ? (AGENT_NAMES[row.name] ?? row.name) : row.name, percent: row.pct }));
}

export function buildContributors({ key, codex, scope, data, failed, range }: ContributorsInput): LimitContributorsView {
  const where = codex ? 'local rollouts on this machine' : 'local sessions on this machine';
  const weight = data?.weight === 'effectiveTokens' ? 'effective tokens' : 'est. cost';
  const view: LimitContributorsView = {
    key,
    title: `What is contributing to your limits${scope}`,
    description: `${range === 'day' ? 'Last 24 hours' : 'Last 7 days'}, approximate, from ${where}${data ? `, weighted by ${weight}` : ''}`,
    help: codex ? CONTRIB_CODEX_HELP : CONTRIB_CLAUDE_HELP,
    state: null,
    range,
    behaviors: [],
    breakdowns: [],
  };
  if (!data) {
    const state: SectionState = failed
      ? { kind: 'error', title: 'Could not load what is contributing', description: SERVER_DOWN }
      : { kind: 'loading', skeleton: 'bars', rows: 4 };
    return { ...view, state };
  }
  if (windowIsEmpty(data.day) && windowIsEmpty(data.week)) {
    return {
      ...view,
      state: {
        kind: 'empty',
        title: 'Nothing stands out yet',
        description: 'Skills, subagents, plugins and MCP servers that take a real share of your usage show up here.',
      },
    };
  }
  const window = data[range];
  return {
    ...view,
    behaviors: window.behaviors.map((behavior) => ({ key: behavior.key, headline: behavior.headline, body: behavior.body })),
    breakdowns: CONTRIB_BREAKDOWNS.filter(({ key: part }) => window[part].length > 0).map(({ key: part, label }) => ({
      key: part,
      label: codex && part === 'subagents' ? 'Auto-reviews and subagents' : label,
      rows: shareRows(window[part], part),
    })),
  };
}

const LIMIT_HITS_HELP =
  'Requests the provider refused because a usage limit was reached, read from local logs. One hit is one episode: every refused retry until that limit reset counts once (the refused requests are in brackets). Usage from other devices is not in the local logs, so a hit there does not show.';
const HIT_PLATFORM: Record<LimitHitEpisode['source'], LivePlatform> = { code: 'claude', cowork: 'claude', codex: 'codex' };

function hitKind(episode: LimitHitEpisode): string {
  switch (episode.kind) {
    case 'session':
      return '5-hour limit';
    case 'weekly':
      return 'Weekly limit';
    case 'model': {
      if (episode.source === 'codex') return 'Premium model limit';
      const name = shortModel(episode.model);
      return name ? `${sentence(name)} limit` : 'Model limit';
    }
    default:
      return 'Usage limit';
  }
}

function hitDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function hitStatus(episode: LimitHitEpisode, now: number): { text: string; active: boolean } {
  if (episode.resetsAt === null) return { text: 'Reset not recorded', active: false };
  if (episode.resetsAt > now) return { text: `Lifts in ${untilFull(episode.resetsAt)}`, active: true };
  return { text: `Blocked for ${hitDuration(episode.resetsAt - episode.start)}`, active: false };
}

export function buildLimitHits({ data, failed, platform, now }: LimitHitsInput): LimitHitsView {
  const view: LimitHitsView = {
    title: `Limit hits${titleScope(platform)}`,
    description: 'Last 30 days, from local logs',
    help: LIMIT_HITS_HELP,
    state: null,
    blocked: false,
    figures: [],
    rows: [],
  };
  if (!data) {
    const state: SectionState = failed
      ? { kind: 'error', title: 'Could not load limit hits', description: SERVER_DOWN }
      : { kind: 'loading', skeleton: 'bars', rows: 3 };
    return { ...view, state };
  }
  const active = data.active;
  return {
    ...view,
    blocked: !!active,
    figures: [
      { key: '7d', label: '7 days', value: String(data.episodes7d), note: plural(data.requests7d, 'refused request', 'refused requests'), alert: false },
      { key: '30d', label: '30 days', value: String(data.episodes30d), note: plural(data.requests30d, 'refused request', 'refused requests'), alert: false },
      {
        key: 'now',
        label: 'Right now',
        value: active ? 'Blocked' : 'Clear',
        note: active ? `${hitKind(active)}, ${hitStatus(active, now).text.toLowerCase()}` : 'No limit is blocking',
        alert: !!active,
      },
    ],
    rows: data.episodes.slice(0, LIMIT_HIT_ROWS).map((episode) => {
      const status = hitStatus(episode, now);
      const side = HIT_PLATFORM[episode.source];
      return {
        key: `${episode.source}|${episode.kind}|${episode.start}`,
        when: dateTimeLabel(episode.start),
        kind: hitKind(episode),
        model: episode.kind !== 'model' && episode.model ? episode.model : null,
        platform: platform === 'both' ? { label: PLATFORM_NOUN[side], color: PLATFORM_COLORS[side] } : null,
        status: episode.requests > 1 ? `${status.text} (${episode.requests})` : status.text,
        active: status.active,
      };
    }),
  };
}

function capNote(row: LimitCapView): string {
  if (row.percent === null) return row.note;
  if (row.percent >= 100) return `Cap reached. ${row.note}.`;
  if (row.tone === 'danger') return `Over ${LIMIT_DANGER_PCT}% of this cap. ${row.note}.`;
  if (row.tone === 'warning') return `Over ${LIMIT_WARN_PCT}% of this cap. ${row.note}.`;
  return row.note;
}

export function buildSpendCaps({ platform, budget, failed, apiMode, hasCaps, actualNote, now }: SpendCapsInput): SpendCapsView | null {
  if (!apiMode && !hasCaps) return null;
  const actual = budget ? budget.some((row) => row.isActual) : actualNote !== null;
  const view: SpendCapsView = {
    title: `Spend vs caps${titleScope(platform)}`,
    description: actualNote
      ? sentence(actualNote.replace(' · ', ', '))
      : platform === 'codex'
        ? 'Estimated from local logs at OpenAI list prices'
        : 'Estimated from local logs',
    help: actual
      ? 'Real cost billed by your LiteLLM gateway (today, this week, this month) against the daily, weekly and monthly USD caps you set in Settings. Caps reset on real calendar boundaries and are stored locally in your browser.'
      : 'Your estimated equivalent API spend against the daily, weekly and monthly USD caps you set in Settings. Caps reset on real calendar boundaries and are stored locally. This is a budgeting aid, not a real bill.',
    state: null,
    rows: [],
  };
  if (!budget) {
    const state: SectionState = failed
      ? { kind: 'error', title: 'Could not load spend', description: SERVER_DOWN }
      : { kind: 'loading', skeleton: 'bars', rows: 3 };
    return { ...view, state };
  }
  const rows = capViews(budget, apiMode, now).map((row) => ({ ...row, note: capNote(row) }));
  return rows.length > 0 ? { ...view, rows } : null;
}
