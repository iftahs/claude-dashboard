import { agentProjectLabel, displayModel } from '@/lib/agents';
import { formatResetCountdown, type BudgetPeriod } from '@/lib/budget';
import { coverageDays } from '@/lib/coverage';
import { ago, compact, untilFull, usd } from '@/lib/format';
import { isTokenExpired } from '@/lib/gauge';
import { limitReadings, limitTone, windowName, type LimitReading } from '@/lib/limits';
import { modelColor } from '@/lib/palette';
import { PLATFORM_NOUN, type Platform } from '@/lib/platform';
import { startOfDay, sumCostToday } from '@/lib/week';
import type { Bucket, CodexLiveData, LiveSubagents, LiveUsageData, MainAgent, WeeklyData, WorkflowRun } from '@/types';

export type OverviewPlatform = 'claude' | 'codex';
export type OverviewTone = 'accent' | 'warning' | 'danger';
export type OverviewStatus = 'loading' | 'error' | 'ready';

export interface OverviewMessage {
  title: string;
  description: string;
}

export interface LimitWindowView {
  key: string;
  label: string;
  percent: number;
  tone: OverviewTone;
  reset: string[];
  binding: boolean;
}

export interface LimitCapView {
  key: string;
  label: string;
  value: string;
  percent: number | null;
  tone: OverviewTone;
  note: string;
}

export interface LimitGlanceView {
  platform: OverviewPlatform;
  name: string;
  plan: string | null;
  status: OverviewStatus;
  windows: LimitWindowView[];
  caps: LimitCapView[];
  message: OverviewMessage | null;
  note: string | null;
}

export interface RunningStatView {
  key: string;
  value: number;
  label: string;
  alert: boolean;
}

export interface RunningBadgeView {
  label: string;
  tone: 'neutral' | 'danger';
}

export type RunningSinceFormat = 'elapsed' | 'ago';

export interface RunningRowView {
  key: string;
  waiting: boolean;
  project: string;
  task: string;
  badge: RunningBadgeView | null;
  model: string;
  modelColor: string | null;
  since: number;
  sinceFormat: RunningSinceFormat;
}

export interface RunningNowView {
  status: OverviewStatus;
  stats: RunningStatView[];
  rows: RunningRowView[];
  more: number;
  message: OverviewMessage | null;
}

export interface SpendLegendView {
  key: OverviewPlatform;
  name: string;
  color: string;
  value: string;
}

export interface SpendCapView {
  label: string;
  value: string;
  percent: number;
  tone: OverviewTone;
  note: string | null;
}

export interface SpendTodayView {
  key: 'cost' | 'tokens';
  label: string;
  status: OverviewStatus | 'empty';
  value: string;
  delta: string | null;
  deltaUp: boolean;
  comparison: string;
  trend: number[];
  trendLabel: string;
  cap: SpendCapView | null;
  legend: SpendLegendView[];
  footnote: string;
  message: OverviewMessage | null;
}

export type BindingPicker = (readings: readonly LimitReading[]) => { pct: number; label: string; reached: boolean } | null;

export interface BindingMark {
  platform: string;
  label: string;
  pct: number;
}

export interface ClaudeLimitsInput {
  live: LiveUsageData | null;
  loading: boolean;
  plan: string | null | undefined;
  apiMode: boolean;
  budget: BudgetPeriod[] | null;
  budgetFailed: boolean;
  pickBinding: BindingPicker;
  now: number;
}

export interface CodexLimitsInput {
  live: CodexLiveData | null;
  loading: boolean;
  apiKey: boolean;
  budget: BudgetPeriod[] | null;
  budgetFailed: boolean;
  pickBinding: BindingPicker;
  now: number;
}

export interface RunningInput {
  claude: LiveSubagents | null;
  codex: LiveSubagents | null;
  workflows: WorkflowRun[];
  showWorkflows: boolean;
  tagCodex: boolean;
  running: number;
  waiting: number;
  liveWorkflows: number;
  loading: boolean;
  failed: boolean;
}

export interface TodayInput {
  platform: Platform;
  coworkOnly: boolean;
  weekly: WeeklyData | null;
  loading: boolean;
  claudeWeekly: WeeklyData | null;
  codexWeekly: WeeklyData | null;
  dayBudget: BudgetPeriod | null;
  now: number;
}

export const RUNNING_ROW_LIMIT = 5;
export const TREND_DAYS = 7;

const DAY_MS = 86_400_000;
const API_PLAN = 'API';
const SERVER_DOWN = 'The dashboard server did not answer. It keeps retrying.';
const PLATFORM_COLOR: Record<OverviewPlatform, string> = {
  claude: 'rgb(var(--platform-claude))',
  codex: 'rgb(var(--platform-codex))',
};
const USAGE_HINT: Record<Platform, string> = {
  claude: 'Use Claude Code',
  codex: 'Run a thread in the ChatGPT desktop app',
  both: 'Use Claude Code or Codex',
};
const COWORK_HINT = 'Use Cowork';
const EMPTY_HINT: Record<SpendTodayView['key'], string> = {
  cost: 'the estimated spend for today shows up here',
  tokens: 'the tokens used today show up here',
};
const TOKENS_FOOTNOTE: Record<Platform, string> = {
  claude: 'Input, output and cache writes. Cache reads do not count toward limits.',
  codex: 'Input and output. Cached input does not count toward limits.',
  both: 'Input, output and cache writes. Cache reads do not count toward limits.',
};

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function toneFor(percent: number): OverviewTone {
  const tone = limitTone(percent);
  return tone === 'success' ? 'accent' : tone;
}

function money(amount: number): string {
  return amount > 0 ? usd(amount) : '$0.00';
}

function estimate(amount: number): string {
  return `~${money(amount)}`;
}

export function planLabel(raw: string | null | undefined): string | null {
  const words = (raw ?? '').trim().replace(/[_-]+/g, ' ');
  return words ? sentence(words.toLowerCase()) : null;
}

export function resetClock(resetsAt: number, now: number): string {
  const date = new Date(resetsAt);
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (resetsAt - now < DAY_MS) return `at ${time}`;
  return `${date.toLocaleDateString('en-US', { weekday: 'long' })} ${time}`;
}

interface WindowSlot {
  key: string;
  label: string;
  usedPct: number;
}

function windowView(slot: WindowSlot, reading: LimitReading | undefined, pickBinding: BindingPicker, now: number): LimitWindowView {
  const shown = reading ? pickBinding([reading]) : null;
  const idle = Math.max(0, Math.min(100, Math.round(Number.isFinite(slot.usedPct) ? slot.usedPct : 0)));
  const percent = shown ? shown.pct : idle;
  const reset =
    reading && reading.resetsAt !== null
      ? [`Resets in ${untilFull(reading.resetsAt)},`, resetClock(reading.resetsAt, now)]
      : ['Opens with your next message'];
  return {
    key: slot.key,
    label: slot.label,
    percent,
    tone: toneFor(percent),
    reset: shown?.reached ? ['Limit reached.', ...reset] : reset,
    binding: false,
  };
}

function windowViews(slots: WindowSlot[], readings: LimitReading[], pickBinding: BindingPicker, now: number): LimitWindowView[] {
  return slots.map((slot) => windowView(slot, readings.find((reading) => reading.key === slot.key), pickBinding, now));
}

function claudeWindows(live: LiveUsageData, pickBinding: BindingPicker, now: number): LimitWindowView[] {
  const slots: WindowSlot[] = [];
  if (live.five_hour) slots.push({ key: 'claude-5h', label: '5-hour limit', usedPct: live.five_hour.utilization });
  if (live.seven_day) slots.push({ key: 'claude-weekly', label: 'Weekly limit', usedPct: live.seven_day.utilization });
  return windowViews(slots, limitReadings(live, null), pickBinding, now);
}

function codexWindows(live: CodexLiveData, pickBinding: BindingPicker, now: number): LimitWindowView[] {
  const slots: WindowSlot[] = [];
  for (const [key, info] of [['codex-5h', live.fiveHour], ['codex-weekly', live.weekly]] as const) {
    if (info) slots.push({ key, label: sentence(`${windowName(info.windowSec)} limit`), usedPct: info.usedPct });
  }
  return windowViews(slots, limitReadings(null, live), pickBinding, now);
}

function capViews(rows: BudgetPeriod[], showUncapped: boolean, now: number): LimitCapView[] {
  return rows
    .filter((row) => showUncapped || row.cap !== null)
    .map((row) => {
      const spent = row.isActual ? money(row.spent) : estimate(row.spent);
      if (row.cap === null || row.pct === null) {
        return { key: row.key, label: row.label, value: spent, percent: null, tone: 'accent', note: 'No cap set' };
      }
      return {
        key: row.key,
        label: row.label,
        value: `${spent} of ${money(row.cap)}`,
        percent: row.pct,
        tone: toneFor(row.pct),
        note: sentence(formatResetCountdown(row.resetsAt, now)),
      };
    });
}

function capsNote(platform: OverviewPlatform, rows: BudgetPeriod[], payAsYouGo: boolean): string {
  const lead = payAsYouGo ? 'Pay-as-you-go has no plan windows. ' : '';
  if (rows.some((row) => row.isActual)) return `${lead}Spend is the actual bill from your gateway.`;
  return platform === 'codex'
    ? `${lead}Spend is estimated from local logs at OpenAI list prices.`
    : `${lead}Spend is estimated from local logs.`;
}

function snapshotNote(live: CodexLiveData): string | null {
  if (live.origin !== 'passive') return null;
  const at = live.snapshotAt ? Date.parse(live.snapshotAt) : NaN;
  const age = Number.isNaN(at) ? 'Snapshot of unknown age' : `Snapshot from ${ago(at)}`;
  return `${age}, from the newest local rollout. Open the ChatGPT app for live numbers.`;
}

type LimitCardBase = Pick<LimitGlanceView, 'platform' | 'name' | 'plan'>;

function limitCard(base: LimitCardBase, rest: Partial<LimitGlanceView>): LimitGlanceView {
  return { ...base, status: 'ready', windows: [], caps: [], message: null, note: null, ...rest };
}

function capsCard(
  base: LimitCardBase,
  budget: BudgetPeriod[] | null,
  budgetFailed: boolean,
  payAsYouGo: boolean,
  message: OverviewMessage | null,
  now: number,
): LimitGlanceView {
  if (budget === null) {
    if (message) return limitCard(base, { message });
    if (!budgetFailed) return limitCard(base, { status: 'loading' });
    return limitCard(base, { status: 'error', message: { title: `Could not load ${base.name} spend`, description: SERVER_DOWN } });
  }
  const caps = capViews(budget, payAsYouGo, now);
  return limitCard(base, { caps, message, note: caps.length > 0 ? capsNote(base.platform, budget, payAsYouGo) : null });
}

function windowsCard(base: LimitCardBase, windows: LimitWindowView[], note: string | null, source: string): LimitGlanceView {
  if (windows.length > 0) return limitCard(base, { windows, note });
  return limitCard(base, {
    message: { title: 'No plan windows reported', description: `${source} did not report a 5-hour or weekly window for this account.` },
  });
}

export function buildClaudeLimits({
  live,
  loading,
  plan,
  apiMode,
  budget,
  budgetFailed,
  pickBinding,
  now,
}: ClaudeLimitsInput): LimitGlanceView {
  const base: LimitCardBase = { platform: 'claude', name: PLATFORM_NOUN.claude, plan: apiMode ? API_PLAN : planLabel(plan) };
  if (apiMode) return capsCard(base, budget, budgetFailed, true, null, now);
  if (live && !live.error) return windowsCard(base, claudeWindows(live, pickBinding, now), null, 'Claude.ai');
  if (live?.error) {
    const title = isTokenExpired(live.error) ? 'Claude.ai token expired' : 'Claude live limits unavailable';
    return capsCard(base, budget, budgetFailed, false, { title, description: live.error }, now);
  }
  if (loading) return limitCard(base, { status: 'loading' });
  return limitCard(base, { status: 'error', message: { title: 'Could not load Claude limits', description: SERVER_DOWN } });
}

export function buildCodexLimits({
  live,
  loading,
  apiKey,
  budget,
  budgetFailed,
  pickBinding,
  now,
}: CodexLimitsInput): LimitGlanceView {
  const usable = live && !live.error ? live : null;
  const base: LimitCardBase = { platform: 'codex', name: PLATFORM_NOUN.codex, plan: apiKey ? API_PLAN : planLabel(usable?.planType) };
  if (apiKey) return capsCard(base, budget, budgetFailed, true, null, now);
  if (usable) return windowsCard(base, codexWindows(usable, pickBinding, now), snapshotNote(usable), 'ChatGPT');
  if (live?.error) {
    const message = isTokenExpired(live.error)
      ? {
          title: 'Codex token expired',
          description: 'Open the ChatGPT desktop app once. It refreshes its own token and this card recovers on the next poll.',
        }
      : { title: 'Codex live limits unavailable', description: live.error };
    return capsCard(base, budget, budgetFailed, false, message, now);
  }
  if (loading) return limitCard(base, { status: 'loading' });
  return limitCard(base, { status: 'error', message: { title: 'Could not load Codex limits', description: SERVER_DOWN } });
}

export function markBinding(cards: LimitGlanceView[], binding: BindingMark | null): LimitGlanceView[] {
  const rows = cards.reduce((count, card) => count + card.windows.length, 0);
  if (!binding || rows < 2) return cards;
  const label = binding.label.toLowerCase();
  return cards.map((card) => {
    if (card.name !== binding.platform) return card;
    const index = card.windows.findIndex((row) => row.label.toLowerCase() === label && row.percent === binding.pct);
    if (index < 0) return card;
    return { ...card, windows: card.windows.map((row, at) => (at === index ? { ...row, binding: true } : row)) };
  });
}

export function limitsNote(cards: LimitGlanceView[]): string {
  if (cards.some((card) => card.windows.length > 0)) return 'How much of each window is used';
  if (cards.some((card) => card.caps.length > 0)) return 'Spend against your caps';
  return '';
}

function modelChip(model: string): Pick<RunningRowView, 'model' | 'modelColor'> {
  const unknown = !model || model === 'inherit' || model === 'unknown';
  return { model: displayModel(model || 'inherit'), modelColor: unknown ? null : modelColor(model) };
}

function isWorking(main: MainAgent): boolean {
  return main.traffic === 'waiting' || main.active || main.delegating;
}

interface PlatformRows {
  sessions: RunningRowView[];
  orphans: RunningRowView[];
}

function platformRows(data: LiveSubagents | null, platform: OverviewPlatform, tagCodex: boolean): PlatformRows {
  if (!data) return { sessions: [], orphans: [] };
  const tag: RunningBadgeView | null = tagCodex && platform === 'codex' ? { label: PLATFORM_NOUN.codex, tone: 'neutral' } : null;
  const shown = data.mainAgents.filter(isWorking);
  const shownKeys = new Set(shown.map((main) => main.key));
  const sessions = shown.map((main): RunningRowView => {
    const waiting = main.traffic === 'waiting';
    const kids = data.running.filter((agent) => agent.parentKey === main.key);
    const children = kids.length;
    const title = main.title || 'Untitled';
    return {
      key: `${platform}:${main.key}`,
      waiting,
      project: agentProjectLabel(main.project),
      task: children > 0 ? `${title}, ${children} ${plural(children, 'subagent', 'subagents')} running` : title,
      badge: waiting ? { label: 'Waiting on you', tone: 'danger' } : tag,
      ...modelChip(main.model),
      since: waiting ? main.lastActivity : Math.max(main.lastActivity, ...kids.map((agent) => agent.lastActivity)),
      sinceFormat: 'ago',
    };
  });
  const orphans = data.running
    .filter((agent) => !shownKeys.has(agent.parentKey))
    .map(
      (agent): RunningRowView => ({
        key: `${platform}:${agent.key}`,
        waiting: false,
        project: agentProjectLabel(agent.project),
        task: agent.description || agent.name || 'Subagent',
        badge: tag,
        ...modelChip(agent.model),
        since: agent.startedAt,
        sinceFormat: 'elapsed',
      }),
    );
  return { sessions, orphans };
}

function workflowRow(run: WorkflowRun): RunningRowView {
  const done = run.agents.filter((agent) => agent.state === 'done').length;
  const active = run.agents.filter((agent) => agent.state === 'running').sort((a, b) => b.startedAt - a.startedAt)[0];
  const parts = [run.name || 'Workflow'];
  if (active?.phaseTitle) parts.push(active.phaseTitle);
  if (run.agentCount > 0) parts.push(`${done} of ${run.agentCount} ${plural(run.agentCount, 'agent', 'agents')} done`);
  return {
    key: `workflow:${run.runId}`,
    waiting: false,
    project: agentProjectLabel(run.project),
    task: parts.join(', '),
    badge: { label: 'Workflow', tone: 'neutral' },
    ...modelChip(run.defaultModel),
    since: run.startedAt,
    sinceFormat: 'elapsed',
  };
}

export function buildRunning({
  claude,
  codex,
  workflows,
  showWorkflows,
  tagCodex,
  running,
  waiting,
  liveWorkflows,
  loading,
  failed,
}: RunningInput): RunningNowView {
  if (!claude && !codex) {
    if (loading) return { status: 'loading', stats: [], rows: [], more: 0, message: null };
    if (failed) {
      return {
        status: 'error',
        stats: [],
        rows: [],
        more: 0,
        message: { title: 'Could not load running agents', description: SERVER_DOWN },
      };
    }
  }
  const stats: RunningStatView[] = [
    { key: 'running', value: running, label: `${plural(running, 'agent', 'agents')} running`, alert: false },
    { key: 'waiting', value: waiting, label: 'waiting on you', alert: waiting > 0 },
  ];
  if (showWorkflows) {
    stats.push({
      key: 'workflows',
      value: liveWorkflows,
      label: `${plural(liveWorkflows, 'workflow', 'workflows')} running`,
      alert: false,
    });
  }
  const claudeRows = platformRows(claude, 'claude', tagCodex);
  const codexRows = platformRows(codex, 'codex', tagCodex);
  const sessions = [...claudeRows.sessions, ...codexRows.sessions];
  const all = [
    ...sessions.filter((row) => row.waiting),
    ...sessions.filter((row) => !row.waiting),
    ...(showWorkflows ? workflows.map(workflowRow) : []),
    ...claudeRows.orphans,
    ...codexRows.orphans,
  ];
  return {
    status: 'ready',
    stats,
    rows: all.slice(0, RUNNING_ROW_LIMIT),
    more: Math.max(0, all.length - RUNNING_ROW_LIMIT),
    message: null,
  };
}

function effectiveToday(buckets: Bucket[] | undefined, now: number): number {
  if (!buckets) return 0;
  const from = startOfDay(now);
  return buckets.reduce((sum, bucket) => (bucket.start >= from ? sum + bucket.effectiveTokens : sum), 0);
}

function deltaOf(today: number, average: number, days: number): Pick<SpendTodayView, 'delta' | 'deltaUp'> {
  if (days < 2 || average <= 0) return { delta: null, deltaUp: false };
  const percent = Math.round(((today - average) / average) * 100);
  return { delta: `${percent > 0 ? '+' : ''}${percent}%`, deltaUp: percent > 0 };
}

function comparisonText(days: number, average: string): string {
  return days < 2 ? 'Not enough history for an average yet' : `vs ${days}-day average of ${average}`;
}

function capView(row: BudgetPeriod | null): SpendCapView | null {
  if (!row || row.cap === null || row.pct === null) return null;
  const spent = row.isActual ? money(row.spent) : estimate(row.spent);
  const reached = row.pct >= 100;
  return {
    label: 'Daily cap',
    value: `${spent} of ${money(row.cap)}`,
    percent: row.pct,
    tone: toneFor(row.pct),
    note: [reached ? 'Daily cap reached.' : '', row.isActual ? 'Billed spend from your gateway.' : ''].filter(Boolean).join(' ') || null,
  };
}

function splitLegend(
  claude: WeeklyData | null,
  codex: WeeklyData | null,
  read: (weekly: WeeklyData) => string,
): SpendLegendView[] {
  if (!claude || !codex) return [];
  return [
    { key: 'claude', name: PLATFORM_NOUN.claude, color: PLATFORM_COLOR.claude, value: read(claude) },
    { key: 'codex', name: PLATFORM_NOUN.codex, color: PLATFORM_COLOR.codex, value: read(codex) },
  ];
}

export function buildToday({
  platform,
  coworkOnly,
  weekly,
  loading,
  claudeWeekly,
  codexWeekly,
  dayBudget,
  now,
}: TodayInput): SpendTodayView[] {
  const shells: Pick<SpendTodayView, 'key' | 'label' | 'trendLabel' | 'footnote'>[] = [
    {
      key: 'cost',
      label: 'Est. spend today',
      trendLabel: `Est. spend per day, last ${TREND_DAYS} days`,
      footnote: 'Estimated equivalent API cost, not a bill.',
    },
    {
      key: 'tokens',
      label: 'Effective tokens today',
      trendLabel: `Effective tokens per day, last ${TREND_DAYS} days`,
      footnote: TOKENS_FOOTNOTE[platform],
    },
  ];
  const blank = { value: '', delta: null, deltaUp: false, comparison: '', trend: [], cap: null, legend: [], message: null };

  if (!weekly) {
    const message = loading ? null : { title: 'Could not load usage for today', description: SERVER_DOWN };
    return shells.map((shell) => ({ ...shell, ...blank, status: loading ? 'loading' : 'error', message }));
  }
  if (weekly.totals.totalTokens === 0) {
    const title = `No usage in the last ${TREND_DAYS} days`;
    const hint = coworkOnly ? COWORK_HINT : USAGE_HINT[platform];
    return shells.map((shell) => ({
      ...shell,
      ...blank,
      status: 'empty',
      message: { title, description: `${hint} and ${EMPTY_HINT[shell.key]}.` },
    }));
  }

  const days = coverageDays(weekly, TREND_DAYS, now);
  const recent = weekly.buckets.slice(-TREND_DAYS);
  const split = platform === 'both';
  const costToday = sumCostToday(weekly.buckets, now);
  const costAverage = weekly.totals.cost / days;
  const tokensToday = effectiveToday(weekly.buckets, now);
  const tokensAverage = weekly.totals.effectiveTokens / days;

  return [
    {
      ...shells[0],
      ...blank,
      status: 'ready',
      value: estimate(costToday),
      ...deltaOf(costToday, costAverage, days),
      comparison: comparisonText(days, estimate(costAverage)),
      trend: recent.map((bucket) => bucket.cost),
      cap: capView(dayBudget),
      legend: split ? splitLegend(claudeWeekly, codexWeekly, (data) => estimate(sumCostToday(data.buckets, now))) : [],
    },
    {
      ...shells[1],
      ...blank,
      status: 'ready',
      value: compact(tokensToday),
      ...deltaOf(tokensToday, tokensAverage, days),
      comparison: comparisonText(days, compact(tokensAverage)),
      trend: recent.map((bucket) => bucket.effectiveTokens),
      legend: split ? splitLegend(claudeWeekly, codexWeekly, (data) => compact(effectiveToday(data.buckets, now))) : [],
    },
  ];
}
