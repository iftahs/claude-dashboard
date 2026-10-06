import type { BudgetPeriod } from '@/lib/budget';
import {
  buildClaudeGauge,
  buildClaudePlans,
  buildCodexGauge,
  buildCodexPlan,
  buildContributors,
  buildHourly,
  buildLimitHits,
  buildSpendCaps,
  claudeExtraUsageView,
  codexCreditsView,
  type ContribRange,
  type ExtraUsageView,
  type HourlyUsageView,
  type LimitContributorsView,
  type LimitGaugeView,
  type LimitHitsView,
  type PlanLimitsView,
  type SpendCapsView,
} from '@/lib/views/live';
import { startOfDay } from '@/lib/week';
import type {
  AccountLive,
  ActiveBlock,
  Bucket,
  CodexBlock,
  CodexLiveData,
  ContribWindow,
  ContributorsData,
  LimitHitEpisode,
  LimitHitsData,
  LiveExtraUsage,
  LiveUsageData,
  RecentData,
  TokenTotals,
} from '@/types';

const NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 86_400_000;
const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-4-5';
const GPT = 'gpt-5.6-terra';
const EXPIRED = 'OAuth token expired. Run any Claude Code command in your terminal to refresh it.';
const ZERO: TokenTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreateTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 0,
  effectiveTokens: 0,
  cost: 0,
};

function iso(hoursFromNow: number): string {
  return new Date(NOW + hoursFromNow * HOUR).toISOString();
}

function totals(effective: number, cacheRead: number, cost: number): TokenTotals {
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

function bucket(start: number, parts: Record<string, number>): Bucket {
  const effective = Object.values(parts).reduce((sum, value) => sum + value, 0);
  const scaled = (factor: number) => Object.fromEntries(Object.entries(parts).map(([model, value]) => [model, value * factor]));
  return {
    ...totals(effective, effective * 20, (effective / 1_000_000) * 14),
    start,
    byModel: scaled(21),
    byModelEffective: parts,
    byModelCost: scaled(14 / 1_000_000),
  };
}

function wave(index: number, scale: number): number {
  return Math.round((Math.sin(index / 2) + 1.15) * scale);
}

const HOURLY_BUCKETS: Bucket[] = Array.from({ length: 24 }, (_, index) => {
  const start = NOW - (NOW % HOUR) - (23 - index) * HOUR;
  const busy = index > 8 ? 1 : 0.2;
  return bucket(start, {
    [OPUS]: wave(index, 420_000 * busy),
    [SONNET]: wave(index + 3, 210_000 * busy),
    [HAIKU]: wave(index + 5, 60_000 * busy),
    [GPT]: index % 5 === 0 ? 150_000 : 0,
  });
});

export const DAILY_BUCKETS: Bucket[] = Array.from({ length: 7 }, (_, index) =>
  bucket(startOfDay(NOW - (6 - index) * DAY), {
    [OPUS]: wave(index, 3_200_000),
    [SONNET]: wave(index + 2, 1_400_000),
    [GPT]: wave(index + 4, 500_000),
  }),
);
export const DAILY_COST_PER_DAY = 62;
export const DAILY_TOKENS_PER_DAY = 5_400_000;

const BLOCK: ActiveBlock = {
  start: NOW - 2.5 * HOUR,
  resetsAt: NOW + 2.5 * HOUR,
  isActive: true,
  totals: totals(2_400_000, 180_000_000, 18.2),
  prevTotals: totals(4_100_000, 250_000_000, 31.4),
  byModel: {},
};

const RECENT: RecentData = {
  rangeFrom: NOW - 24 * HOUR,
  rangeTo: NOW,
  buckets: HOURLY_BUCKETS,
  totals: totals(14_000_000, 300_000_000, 190),
  byModel: [],
  activeBlock: BLOCK,
};

const EXTRA_USAGE: LiveExtraUsage = {
  is_enabled: true,
  monthly_limit: 25_000,
  used_credits: 6_607,
  utilization: 26.4,
  currency: 'USD',
  decimal_places: 2,
  disabled_reason: null,
  daily: null,
  weekly: null,
};

function claudeLive(fiveHour: number, weekly: number, resetsInHours: number): LiveUsageData {
  return {
    five_hour: { utilization: fiveHour, resets_at: iso(resetsInHours) },
    seven_day: { utilization: weekly, resets_at: iso(71) },
    limits: [
      {
        kind: 'weekly_scoped',
        group: 'weekly',
        percent: 61,
        severity: 'ok',
        resets_at: iso(71),
        scope: { model: { id: 'opus', display_name: 'Opus' } },
        is_active: true,
      },
      {
        kind: 'weekly_scoped',
        group: 'weekly',
        percent: 12,
        severity: 'ok',
        resets_at: null,
        scope: { model: { id: 'fable', display_name: 'Fable' } },
        is_active: false,
      },
    ],
    seven_day_breakdown: {
      as_of: null,
      window_started_at: null,
      rows: [
        { key: 'claude_code', display_name: null, percent: 60 },
        { key: 'chat', display_name: null, percent: 25 },
        { key: 'cowork', display_name: null, percent: 10 },
        { key: 'other', display_name: null, percent: 5 },
      ],
    },
  };
}

const CLAUDE_ERROR = { error: EXPIRED } as LiveUsageData;

const GAUGE_BASE = {
  named: false,
  block: BLOCK,
  loading: false,
  failed: false,
  isApi: false,
  costPerDay: 42,
  dailyLimit: 60,
  permission: null,
  todayActualCost: null,
  now: NOW,
};

const CODEX_LIVE: CodexLiveData = {
  planType: 'pro',
  fiveHour: { usedPct: 35, windowSec: 18_000, resetsAt: iso(3) },
  weekly: { usedPct: 62, windowSec: 604_800, resetsAt: iso(100) },
  limitReached: false,
  credits: { hasCredits: true, unlimited: false, balance: '42.50', overageLimitReached: true },
  resetCredits: { available: 2, applicable: 1 },
  modelAvailability: { 'gpt-6-sol': true, 'gpt-6-astra': false },
  origin: 'live',
  snapshotAt: null,
};

const CODEX_SNAPSHOT: CodexLiveData = {
  ...CODEX_LIVE,
  planType: 'plus',
  fiveHour: { usedPct: 0, windowSec: 18_000, resetsAt: null },
  weekly: { usedPct: 13, windowSec: 604_800, resetsAt: iso(92) },
  credits: { hasCredits: false, unlimited: false, balance: '0', overageLimitReached: false },
  resetCredits: null,
  modelAvailability: {},
  origin: 'passive',
  snapshotAt: iso(-3),
  warning: 'live usage unavailable: the request timed out',
};

const CODEX_BLOCK: CodexBlock = {
  start: NOW - 2 * HOUR,
  resetsAt: NOW + 3 * HOUR,
  isActive: true,
  totals: totals(1_200_000, 5_000_000, 4.2),
  prevTotals: totals(436_000, 13_000_000, 8.08),
  byModel: {},
  windowSec: 18_000,
  anchor: 'live',
};

const CODEX_GAUGE_BASE = {
  ...GAUGE_BASE,
  block: CODEX_BLOCK,
  liveFailed: null,
  windowSec: 18_000,
};

export const GAUGE_VIEWS: LimitGaugeView[] = [
  buildClaudeGauge({ ...GAUGE_BASE, live: claudeLive(40, 83, 2.5) }),
  buildClaudeGauge({ ...GAUGE_BASE, live: claudeLive(83, 50, 0.4), permission: 'ask' }),
  buildClaudeGauge({ ...GAUGE_BASE, live: claudeLive(100, 91, 1.2) }),
  buildClaudeGauge({ ...GAUGE_BASE, live: CLAUDE_ERROR, permission: 'blocked' }),
  buildCodexGauge({ ...CODEX_GAUGE_BASE, named: true, live: CODEX_SNAPSHOT }),
  buildCodexGauge({ ...CODEX_GAUGE_BASE, named: true, live: null, liveFailed: 'ChatGPT answered HTTP 500' }),
  buildClaudeGauge({ ...GAUGE_BASE, live: null, isApi: true, todayActualCost: 31.2 }),
  buildCodexGauge({ ...CODEX_GAUGE_BASE, named: true, live: CODEX_LIVE, isApi: true, dailyLimit: null }),
  buildClaudeGauge({ ...GAUGE_BASE, block: null, loading: true, live: null }),
  buildClaudeGauge({ ...GAUGE_BASE, block: null, failed: true, live: null }),
];

export const GAUGE_WIDE_VIEW: LimitGaugeView = buildClaudeGauge({ ...GAUGE_BASE, named: true, live: claudeLive(40, 83, 2.5) });

const HOURLY_BASE = { loading: false, failed: false, hours: 24, platform: 'both' as const, coworkOnly: false };

export const HOURLY_VIEW: HourlyUsageView = buildHourly({ ...HOURLY_BASE, recent: RECENT });
export const HOURLY_STATE_VIEWS: HourlyUsageView[] = [
  buildHourly({ ...HOURLY_BASE, recent: null, loading: true }),
  buildHourly({ ...HOURLY_BASE, recent: { ...RECENT, totals: ZERO }, platform: 'codex' }),
  buildHourly({ ...HOURLY_BASE, recent: null, failed: true }),
];

function account(key: string, label: string, plan: string, live: LiveUsageData, isActive: boolean): AccountLive {
  return {
    key,
    organizationUuid: key,
    email: label,
    label,
    subscriptionType: plan,
    rateLimitTier: null,
    live,
    expired: false,
    isActive,
    capturedAt: NOW,
  };
}

const PLAN_BASE = { accounts: [], liveLoading: false, block: BLOCK, weeklyEffective: 21_000_000, plan: 'max_20x', weekStart: 'monday' as const, now: NOW };

export const PLAN_WIDE_VIEW: PlanLimitsView = buildClaudePlans({ ...PLAN_BASE, live: claudeLive(40, 83, 2.5) })[0];
export const PLAN_VIEWS: PlanLimitsView[] = [
  ...buildClaudePlans({
    ...PLAN_BASE,
    live: null,
    accounts: [
      account('org-a', 'first.account.with.a.long.name@example-company.com', 'max_20x', claudeLive(40, 83, 2.5), true),
      account('org-b', 'second@example.com', 'team', CLAUDE_ERROR, false),
    ],
  }),
  buildCodexPlan({ live: CODEX_LIVE, failed: null, weekStart: 'monday', now: NOW }),
  buildCodexPlan({ live: { ...CODEX_SNAPSHOT, fiveHour: { usedPct: 98, windowSec: 18_000, resetsAt: iso(1.5) }, limitReached: true }, failed: null, weekStart: 'monday', now: NOW }),
  ...buildClaudePlans({ ...PLAN_BASE, live: CLAUDE_ERROR }),
  buildCodexPlan({ live: { ...CODEX_LIVE, error: 'Codex token expired' }, failed: null, weekStart: 'monday', now: NOW }),
  ...buildClaudePlans({ ...PLAN_BASE, live: null, liveLoading: true }),
];

const UNLIMITED_CREDITS = codexCreditsView({
  ...CODEX_LIVE,
  credits: { hasCredits: true, unlimited: true, balance: null, overageLimitReached: false },
  resetCredits: null,
});
const CODEX_CREDITS = codexCreditsView(CODEX_LIVE);

export const EXTRA_VIEWS: ExtraUsageView[] = [
  claudeExtraUsageView(
    EXTRA_USAGE,
    {
      used: { amount_minor: 6_607, currency: 'USD', exponent: 2 },
      limit: null,
      percent: 26,
      severity: 'ok',
      enabled: true,
      disabled_reason: null,
      cap: null,
      balance: null,
      auto_reload: null,
      disclaimer: 'Extra usage is billed at standard API rates. [Learn more](https://example.com/extra-usage)',
      can_purchase_credits: true,
      can_toggle: true,
    },
    true,
  ),
  claudeExtraUsageView({ ...EXTRA_USAGE, used_credits: 23_400, utilization: 93.6 }, null, true),
  ...(CODEX_CREDITS ? [CODEX_CREDITS] : []),
  ...(UNLIMITED_CREDITS ? [UNLIMITED_CREDITS] : []),
];
export const EXTRA_OFF_VIEWS: ExtraUsageView[] = [
  claudeExtraUsageView({ ...EXTRA_USAGE, is_enabled: false, user_disabled: true }, null, true),
  claudeExtraUsageView({ ...EXTRA_USAGE, is_enabled: false, disabled_reason: 'out_of_credits' }, null, true),
];

const CONTRIB_DAY: ContribWindow = {
  totalCost: 120,
  requestCount: 900,
  sessionCount: 14,
  behaviors: [
    {
      key: 'subagent_heavy',
      headline: '74% of your usage came from subagent-heavy sessions',
      body: 'Each subagent runs its own requests. Be deliberate about spawning them, and consider a cheaper model for simpler subagents.',
      pct: 74,
    },
    {
      key: 'long_context',
      headline: '61% of your usage was at >150k context',
      body: 'Longer sessions are more expensive even when cached. Compact mid-task and clear when switching tasks.',
      pct: 61,
    },
  ],
  skills: [
    { name: 'code-review', pct: 34 },
    { name: 'dataviz', pct: 12 },
  ],
  subagents: [
    { name: 'general-purpose', pct: 58 },
    { name: 'guardian_review', pct: 18 },
  ],
  plugins: [{ name: 'caveman', pct: 21 }],
  mcpServers: [{ name: 'Claude Browser', pct: 16 }],
};
const CONTRIB_EMPTY: ContribWindow = {
  totalCost: 0,
  requestCount: 0,
  sessionCount: 0,
  behaviors: [],
  subagents: [],
  mcpServers: [],
  skills: [],
  plugins: [],
};
const CONTRIBUTORS: ContributorsData = { day: CONTRIB_DAY, week: CONTRIB_EMPTY, weight: 'cost' };

export function contributorsView(range: ContribRange): LimitContributorsView {
  return buildContributors({ key: 'ready', codex: false, scope: ' · Claude', data: CONTRIBUTORS, failed: false, range });
}

export const CONTRIBUTOR_STATE_VIEWS: LimitContributorsView[] = [
  buildContributors({ key: 'empty', codex: true, scope: ' · Codex', data: { day: CONTRIB_EMPTY, week: CONTRIB_EMPTY }, failed: false, range: 'day' }),
  buildContributors({ key: 'loading', codex: false, scope: '', data: null, failed: false, range: 'day' }),
  buildContributors({ key: 'failed', codex: false, scope: '', data: null, failed: true, range: 'week' }),
];

function episode(
  kind: LimitHitEpisode['kind'],
  source: LimitHitEpisode['source'],
  model: string,
  startedHoursAgo: number,
  resetsInHours: number | null,
  requests: number,
): LimitHitEpisode {
  const start = NOW - startedHoursAgo * HOUR;
  return { start, last: start + 600_000, resetsAt: resetsInHours === null ? null : NOW + resetsInHours * HOUR, kind, source, model, requests };
}

const HITS: LimitHitsData = {
  rangeFrom: NOW - 30 * DAY,
  rangeTo: NOW,
  episodes7d: 3,
  episodes30d: 5,
  requests7d: 15,
  requests30d: 22,
  active: episode('weekly', 'code', OPUS, 2, 30, 12),
  episodes: [
    episode('weekly', 'code', OPUS, 2, 30, 12),
    episode('model', 'code', 'claude-fable-5-1', 30, -26, 1),
    episode('session', 'codex', GPT, 52, -49.5, 2),
    episode('unknown', 'cowork', '', 80, null, 3),
  ],
};
const NO_HITS: LimitHitsData = { ...HITS, episodes7d: 0, episodes30d: 0, requests7d: 0, requests30d: 0, active: null, episodes: [] };

export const HIT_VIEWS: LimitHitsView[] = [
  buildLimitHits({ data: HITS, failed: false, platform: 'both', now: NOW }),
  buildLimitHits({ data: NO_HITS, failed: false, platform: 'claude', now: NOW }),
  buildLimitHits({ data: null, failed: false, platform: 'codex', now: NOW }),
  buildLimitHits({ data: null, failed: true, platform: 'claude', now: NOW }),
];

function period(key: BudgetPeriod['key'], label: string, spent: number, cap: number | null, resetsInHours: number, isActual: boolean): BudgetPeriod {
  return {
    key,
    label,
    spent,
    cap,
    pct: cap === null ? null : Math.min(100, (spent / cap) * 100),
    resetsAt: NOW + resetsInHours * HOUR,
    isActual,
  };
}

const CAPS_BASE = { failed: false, apiMode: false, hasCaps: true, actualNote: null, now: NOW };

function caps(view: SpendCapsView | null): SpendCapsView[] {
  return view ? [view] : [];
}

export const CAP_VIEWS: SpendCapsView[] = [
  ...caps(
    buildSpendCaps({
      ...CAPS_BASE,
      platform: 'claude',
      budget: [period('day', 'Today', 33.1, 60, 9, false), period('week', 'This week', 412.8, 450, 80, false), period('month', 'This month', 1204, 1600, 500, false)],
    }),
  ),
  ...caps(
    buildSpendCaps({
      ...CAPS_BASE,
      platform: 'claude',
      apiMode: true,
      actualNote: 'actual · via gateway.example.com',
      budget: [period('day', 'Today', 31.2, 50, 9, true), period('week', 'This week', 68.95, null, 80, true), period('month', 'This month', 163.2, null, 500, true)],
    }),
  ),
  ...caps(buildSpendCaps({ ...CAPS_BASE, platform: 'codex', budget: [period('day', 'Today', 10, 10, 9, false)] })),
  ...caps(buildSpendCaps({ ...CAPS_BASE, platform: 'both', budget: null })),
  ...caps(buildSpendCaps({ ...CAPS_BASE, platform: 'both', budget: null, failed: true })),
];
