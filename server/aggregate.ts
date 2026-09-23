import type { UsageEvent, UsageSource } from './scan.ts';
import type { LimitHitRow } from './scan-pass.ts';
import { estimateCost } from './pricing.ts';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const BLOCK_MS = 5 * HOUR;

export interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  effectiveTokens: number; // input + output + cacheCreate (excl. cheap cache reads)
  cost: number;
}

export interface Bucket extends TokenTotals {
  start: number;
  /** Total tokens per model, cache reads included. */
  byModel: Record<string, number>;
  /** Effective tokens per model (input + output + cacheCreate) — what the token charts stack. */
  byModelEffective: Record<string, number>;
  byModelCost: Record<string, number>;
}

export interface ModelShare extends TokenTotals {
  model: string;
}

function emptyTotals(): TokenTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreateTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    effectiveTokens: 0,
    cost: 0,
  };
}

function add(t: TokenTotals, e: UsageEvent): void {
  t.inputTokens += e.inputTokens;
  t.outputTokens += e.outputTokens;
  t.cacheCreateTokens += e.cacheCreateTokens;
  t.cacheReadTokens += e.cacheReadTokens;
  t.totalTokens += e.inputTokens + e.outputTokens + e.cacheCreateTokens + e.cacheReadTokens;
  t.effectiveTokens += e.inputTokens + e.outputTokens + e.cacheCreateTokens;
  t.cost += estimateCost(e.model, e);
}

function eventTokens(e: UsageEvent): number {
  return e.inputTokens + e.outputTokens + e.cacheCreateTokens + e.cacheReadTokens;
}

/** Effective tokens of one event: input + output + cacheCreate (cache reads excluded). */
function effectiveOf(e: UsageEvent): number {
  return e.inputTokens + e.outputTokens + e.cacheCreateTokens;
}

/** Calendar arithmetic, not +24h steps — a DST day is 23/25h and fixed steps would drift, skip or repeat a date. */
export function localDayStarts(from: number, to: number): number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];
  const d = new Date(from);
  const out: number[] = [];
  for (let i = 0; ; i++) {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i).getTime();
    if (s >= to) return out;
    out.push(s);
  }
}

/** Index of the last entry of ascending `starts` that is <= t (-1 if none). */
function floorIndex(starts: number[], t: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= t) lo = mid + 1;
    else hi = mid - 1;
  }
  return hi;
}

function bucketize(events: UsageEvent[], from: number, to: number, width: number): Bucket[] {
  // Day-wide buckets start at local midnight (TZ/DST-aware) so events land on their local calendar date; narrower ones align to epoch multiples.
  let starts: number[];
  if (width === DAY) {
    starts = localDayStarts(from, to);
  } else {
    starts = [];
    for (let s = Math.floor(from / width) * width; s < to; s += width) starts.push(s);
  }
  const buckets: Bucket[] = starts.map((start) => ({
    start,
    byModel: {},
    byModelEffective: {},
    byModelCost: {},
    ...emptyTotals(),
  }));
  if (buckets.length === 0) return buckets;
  const start0 = starts[0];
  for (const e of events) {
    if (e.ts < start0 || e.ts >= to) continue;
    const idx = width === DAY ? floorIndex(starts, e.ts) : Math.floor((e.ts - start0) / width);
    const b = buckets[idx];
    if (!b) continue;
    add(b, e);
    b.byModel[e.model] = (b.byModel[e.model] ?? 0) + eventTokens(e);
    b.byModelEffective[e.model] = (b.byModelEffective[e.model] ?? 0) + effectiveOf(e);
    b.byModelCost[e.model] = (b.byModelCost[e.model] ?? 0) + estimateCost(e.model, e);
  }
  return buckets;
}

function modelShares(events: UsageEvent[]): ModelShare[] {
  const map = new Map<string, TokenTotals>();
  for (const e of events) {
    let t = map.get(e.model);
    if (!t) {
      t = emptyTotals();
      map.set(e.model, t);
    }
    add(t, e);
  }
  // Ranked by effective tokens, not total — cache reads dominate raw totals and would skew the ranking.
  return [...map.entries()]
    .map(([model, t]) => ({ model, ...t }))
    .filter((m) => m.totalTokens > 0 && m.model !== '<synthetic>')
    .sort((a, b) => b.effectiveTokens - a.effectiveTokens || b.totalTokens - a.totalTokens);
}

function sumTotals(events: UsageEvent[]): TokenTotals {
  const t = emptyTotals();
  for (const e of events) add(t, e);
  return t;
}

export interface SourceSplit {
  code: TokenTotals;
  cowork: TokenTotals;
  codex: TokenTotals;
}

/** Effective-token totals split by surface (Code / Cowork / Codex) for the Sources card. */
function sourceSplit(events: UsageEvent[]): SourceSplit {
  const split: SourceSplit = { code: emptyTotals(), cowork: emptyTotals(), codex: emptyTotals() };
  for (const e of events) add(e.source === 'cowork' ? split.cowork : e.source === 'codex' ? split.codex : split.code, e);
  return split;
}

export interface CodexSplit {
  /** User threads (every rollout that is not a guardian review). */
  threads: TokenTotals;
  /** Guardian auto-reviews, folded into their parent thread by the parser. */
  guardian: TokenTotals;
}

export function isGuardianReview(e: UsageEvent): boolean {
  return e.attributionAgent === 'guardian_review';
}

/** Codex events of the window split into threads vs guardian reviews (non-Codex events are ignored). */
function codexSplit(events: UsageEvent[]): CodexSplit {
  const split: CodexSplit = { threads: emptyTotals(), guardian: emptyTotals() };
  for (const e of events) {
    if (e.source !== 'codex') continue;
    add(isGuardianReview(e) ? split.guardian : split.threads, e);
  }
  return split;
}

/**
 * `?source=` filter. Besides the single surfaces, 'claude' selects every Anthropic
 * surface (code + cowork) — what the frontend's Claude platform sends once Codex
 * data exists, so "Claude" never silently includes OpenAI usage.
 */
export type SourceFilter = 'all' | 'claude' | UsageSource;

/** Does an event/session tagged `s` belong to the filter `f`? */
export function sourceMatches(s: UsageSource, f: SourceFilter): boolean {
  if (f === 'all') return true;
  if (f === 'claude') return s !== 'codex';
  return s === f;
}

/** Narrow an event list to one surface (or platform); 'all' passes everything through. */
export function filterSource(events: UsageEvent[], source: SourceFilter): UsageEvent[] {
  if (source === 'all') return events;
  return events.filter((e) => sourceMatches(e.source, source));
}

/** True only when the filter includes Code — a Codex/Cowork heatmap would otherwise show Code's history as its own. */
export function statsCacheApplies(source: SourceFilter): boolean {
  return source === 'all' || source === 'claude' || source === 'code';
}

export interface ActiveBlock {
  start: number;
  resetsAt: number;
  isActive: boolean;
  totals: TokenTotals;
  prevTotals: TokenTotals;
  byModel: Record<string, number>;
}

/** Compute next Monday 01:00 UTC — Anthropic's weekly reset schedule. */
function nextMondayReset(now: number): number {
  const d = new Date(now);
  d.setUTCHours(1, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon
  let daysToAdd = (1 - day + 7) % 7;
  if (daysToAdd === 0 && d.getTime() <= now) daysToAdd = 7;
  d.setUTCDate(d.getUTCDate() + daysToAdd);
  return d.getTime();
}

/** Splits one session's ascending events into consecutive 5h windows; the first message at/after a window's end opens the next. */
function rollingWindows(sessionEvents: UsageEvent[]): UsageEvent[][] {
  const out: UsageEvent[][] = [];
  let cur: UsageEvent[] = [];
  let winStart = -Infinity;
  for (const e of sessionEvents) {
    if (e.ts >= winStart + BLOCK_MS) {
      if (cur.length) out.push(cur);
      cur = [];
      winStart = e.ts;
    }
    cur.push(e);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Use the most recent sessionId to anchor the block — mirrors how Anthropic
 *  counts: the window ROLLS inside the session; prevTotals is the window right before it.
 *
 *  NOTE: Claude.ai sessions are server-side only and NOT in local logs.
 *  This shows the current Claude Code session window. */
function computeActiveBlock(events: UsageEvent[], now: number): ActiveBlock {
  const idle = {
    start: now,
    resetsAt: now + BLOCK_MS,
    isActive: false,
    totals: emptyTotals(),
    prevTotals: emptyTotals(),
    byModel: {},
  };
  if (events.length === 0) return idle;

  // Current session = most recent sessionId
  const currentSessionId = events[events.length - 1].sessionId;
  const sessionEvents = currentSessionId
    ? events.filter((e) => e.sessionId === currentSessionId)
    : [events[events.length - 1]];

  const windows = rollingWindows(sessionEvents);
  const current = windows[windows.length - 1];
  const blockStart = current[0].ts;
  const resetsAt = blockStart + BLOCK_MS;
  const isActive = now < resetsAt;

  // Previous block = the window before this one, or — for a session's first window — the previous session's last window.
  let previous: UsageEvent[] = windows.length > 1 ? windows[windows.length - 2] : [];
  if (windows.length === 1 && currentSessionId) {
    let prevId = '';
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].sessionId !== currentSessionId) {
        prevId = events[i].sessionId;
        break;
      }
    }
    if (prevId) previous = rollingWindows(events.filter((e) => e.sessionId === prevId)).at(-1) ?? [];
  }

  const totals = sumTotals(current);
  const prevTotals = sumTotals(previous);
  const byModel: Record<string, number> = {};
  for (const e of current) byModel[e.model] = (byModel[e.model] ?? 0) + eventTokens(e);

  return { start: blockStart, resetsAt, isActive, totals, prevTotals, byModel };
}

export interface PrevPeriod {
  totals: TokenTotals;
  rangeFrom: number;
  rangeTo: number;
}

export function buildRecent(events: UsageEvent[], now: number, hours = 5) {
  const from = now - hours * HOUR;
  const windowEvents = events.filter((e) => e.ts >= from);
  return {
    rangeFrom: from,
    rangeTo: now,
    buckets: bucketize(events, from, now, HOUR),
    totals: sumTotals(windowEvents),
    byModel: modelShares(windowEvents),
    bySource: sourceSplit(windowEvents),
    // The 5h block is an Anthropic concept (one window per Claude session); a
    // trailing Codex event must never become its anchor under the All filter.
    activeBlock: computeActiveBlock(events.filter((e) => e.source !== 'codex'), now),
  };
}

/** One Codex rate-limit window as /api/codex/live reports it (structural, so this module stays I/O-free). */
export interface CodexWindowInput {
  windowSec: number;
  /** ISO; null when the window has lapsed or its reset is unknown. */
  resetsAt: string | null;
}

export interface CodexBlock extends ActiveBlock {
  windowSec: number;
  /** 'live'/'passive': the provider's own window (start = reset − length). 'local': no reset known, so windows roll from the first Codex event. */
  anchor: 'live' | 'passive' | 'local';
}

/** `events` must be Codex-only and ascending — uses the provider's reset window when known, else rolls locally from the event stream. */
export function computeCodexBlock(
  events: UsageEvent[],
  live: { fiveHour: CodexWindowInput | null; weekly: CodexWindowInput | null; origin: 'live' | 'passive' } | null,
  now: number,
): CodexBlock {
  const win = live ? (live.fiveHour ?? live.weekly) : null;
  const windowSec = win && win.windowSec > 0 ? win.windowSec : BLOCK_MS / 1000;
  const windowMs = windowSec * 1000;
  const blockOf = (current: UsageEvent[], previous: UsageEvent[], start: number, anchor: CodexBlock['anchor']): CodexBlock => {
    const byModel: Record<string, number> = {};
    for (const e of current) byModel[e.model] = (byModel[e.model] ?? 0) + eventTokens(e);
    const resetsAt = start + windowMs;
    return {
      start, resetsAt, isActive: now < resetsAt,
      totals: sumTotals(current), prevTotals: sumTotals(previous), byModel,
      windowSec, anchor,
    };
  };

  const resetsAt = win?.resetsAt ? Date.parse(win.resetsAt) : NaN;
  if (live && Number.isFinite(resetsAt) && resetsAt > now) {
    const start = resetsAt - windowMs;
    const current = events.filter((e) => e.ts >= start && e.ts <= now);
    const previous = events.filter((e) => e.ts >= start - windowMs && e.ts < start);
    return blockOf(current, previous, start, live.origin);
  }

  // Local anchor: account-wide rolling windows over the whole Codex stream.
  let current: UsageEvent[] = [];
  let previous: UsageEvent[] = [];
  let start = -Infinity;
  for (const e of events) {
    if (e.ts >= start + windowMs) {
      previous = current;
      current = [];
      start = e.ts;
    }
    current.push(e);
  }
  // No Codex events at all: an idle, not-yet-opened window (like computeActiveBlock's).
  if (!current.length) return { ...blockOf([], [], now, 'local'), isActive: false };
  return blockOf(current, previous, start, 'local');
}

/** Retries while an episode is still blocked count as one episode, not many separate hits. */
export interface LimitHitEpisode {
  /** First refused request (epoch ms). */
  start: number;
  /** Last refused request in the episode. */
  last: number;
  /** When the provider said the limit lifts; null when it did not say. */
  resetsAt: number | null;
  kind: LimitHitRow['kind'];
  source: UsageSource;
  model: string;
  /** Refused requests in the episode. */
  requests: number;
}

export interface LimitHitsSummary {
  rangeFrom: number;
  rangeTo: number;
  episodes7d: number;
  episodes30d: number;
  requests7d: number;
  requests30d: number;
  /** The newest episode whose limit has not lifted yet, if any. */
  active: LimitHitEpisode | null;
  /** Episodes that started inside the requested window, newest first (at most LIMIT_EPISODES_MAX). */
  episodes: LimitHitEpisode[];
}

const LIMIT_EPISODES_MAX = 50;

/** Groups refusals into episodes per (platform, kind[, model]); a refusal joins the open episode until its reset time, or an hour after the latest refusal if none was recorded. */
export function buildLimitHits(hits: LimitHitRow[], now: number, days: number): LimitHitsSummary {
  const sorted = [...hits].sort((a, b) => a.ts - b.ts);
  const open = new Map<string, LimitHitEpisode>();
  const episodes: LimitHitEpisode[] = [];
  for (const h of sorted) {
    // Claude's limits are account-wide, so Code and Cowork refusals of one limit are one episode.
    const platform = h.source === 'codex' ? 'codex' : 'claude';
    const group = `${platform}|${h.kind}|${h.kind === 'model' ? h.model : ''}`;
    const cur = open.get(group);
    const until = cur ? (cur.resetsAt !== null && cur.resetsAt > cur.start ? cur.resetsAt : cur.last + HOUR) : -Infinity;
    if (cur && h.ts < until) {
      cur.last = h.ts;
      cur.requests += 1;
      if (cur.resetsAt === null && h.resetsAt !== null) cur.resetsAt = h.resetsAt;
      if (!cur.model && h.model) cur.model = h.model;
      continue;
    }
    const ep: LimitHitEpisode = {
      start: h.ts, last: h.ts, resetsAt: h.resetsAt, kind: h.kind, source: h.source, model: h.model, requests: 1,
    };
    open.set(group, ep);
    episodes.push(ep);
  }

  const since = (ms: number) => now - ms;
  const from = since(days * DAY);
  const count = <T>(list: T[], ts: (x: T) => number, windowMs: number) =>
    list.reduce((n, x) => (ts(x) >= since(windowMs) && ts(x) <= now ? n + 1 : n), 0);
  const newestFirst = episodes.filter((e) => e.start <= now).reverse();
  return {
    rangeFrom: from,
    rangeTo: now,
    episodes7d: count(episodes, (e) => e.start, 7 * DAY),
    episodes30d: count(episodes, (e) => e.start, 30 * DAY),
    requests7d: count(sorted, (h) => h.ts, 7 * DAY),
    requests30d: count(sorted, (h) => h.ts, 30 * DAY),
    active: newestFirst.find((e) => e.resetsAt !== null && e.resetsAt > now) ?? null,
    episodes: newestFirst.filter((e) => e.start >= from).slice(0, LIMIT_EPISODES_MAX),
  };
}

export function buildWeekly(events: UsageEvent[], now: number, days = 7) {
  const from = now - days * DAY;
  const prevFrom = from - days * DAY;
  const windowEvents = events.filter((e) => e.ts >= from);
  const prevEvents = events.filter((e) => e.ts >= prevFrom && e.ts < from);

  // Cache efficiency per day
  const dayBuckets = bucketize(windowEvents, from, now, DAY);
  const cacheEfficiency = dayBuckets
    .filter((b) => b.totalTokens > 0)
    .map((b) => ({
      date: localDateKey(b.start),
      hitRate: b.totalTokens > 0 ? (b.cacheReadTokens / b.totalTokens) * 100 : 0,
      cacheReadTokens: b.cacheReadTokens,
      totalTokens: b.totalTokens,
    }));

  return {
    rangeFrom: from,
    rangeTo: now,
    weeklyResetsAt: nextMondayReset(now),
    buckets: bucketize(events, from, now, DAY),
    totals: sumTotals(windowEvents),
    prevTotals: sumTotals(prevEvents),
    byModel: modelShares(windowEvents),
    bySource: sourceSplit(windowEvents),
    codexSplit: codexSplit(windowEvents),
    cacheEfficiency,
    // Earliest event in the filtered history — lets the UI tell "history starts here" from "quiet period". Events arrive sorted.
    firstEventTs: events.length ? events[0].ts : null,
  };
}

export function buildModels(events: UsageEvent[], now: number, days: number) {
  const from = now - days * 24 * HOUR;
  const windowEvents = events.filter((e) => e.ts >= from);
  return { rangeFrom: from, rangeTo: now, models: modelShares(windowEvents) };
}

function localDateKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD of `ms` in UTC — how OpenAI labels the days of its server-side counts. */
function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** UTC midnight of every UTC day from `from`'s day up to (not including) `to`. UTC has no DST. */
function utcDayStarts(from: number, to: number): number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];
  const d = new Date(from);
  const out: number[] = [];
  for (let s = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); s < to; s += DAY) out.push(s);
  return out;
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD — local calendar day, or the UTC day with { utc: true }
  effectiveTokens: number;
  /** Every token, cache reads included — the unit of OpenAI's server-side daily count. */
  totalTokens: number;
  messageCount: number;
  toolCallCount: number;
}

export interface ActivityOptions {
  /** Buckets by UTC day to match a server-side series keyed by UTC date (Codex's `dailyUsage`); the stats-cache fallback (local days) is skipped. */
  utc?: boolean;
}

/** Daily activity derived live from JSONL events (always current, unlike the
 *  stale stats-cache.json). Fills every day in the window so the heatmap is dense. */
export function buildActivity(events: UsageEvent[], now: number, days: number, stats?: any, opts: ActivityOptions = {}) {
  const utc = !!opts.utc;
  const keyOf = utc ? utcDateKey : localDateKey;
  const map = new Map<string, DailyActivity>();
  const from = now - days * DAY;
  if (utc) stats = undefined;

  const cacheActivityMap = new Map<string, { messageCount: number; toolCallCount: number }>();
  if (stats?.dailyActivity) {
    for (const item of stats.dailyActivity) {
      if (item.date) {
        cacheActivityMap.set(item.date, {
          messageCount: item.messageCount ?? 0,
          toolCallCount: item.toolCallCount ?? 0,
        });
      }
    }
  }

  const cacheTokensMap = new Map<string, number>();
  if (stats?.dailyModelTokens) {
    for (const item of stats.dailyModelTokens) {
      if (item.date && item.tokensByModel) {
        let sum = 0;
        for (const modelKey of Object.keys(item.tokensByModel)) {
          const val = item.tokensByModel[modelKey];
          sum += typeof val === 'number' ? val : 0;
        }
        cacheTokensMap.set(item.date, sum);
      }
    }
  }

  for (const e of events) {
    if (e.ts < from) continue;
    const key = keyOf(e.ts);
    let a = map.get(key);
    if (!a) {
      a = { date: key, effectiveTokens: 0, totalTokens: 0, messageCount: 0, toolCallCount: 0 };
      map.set(key, a);
    }
    a.effectiveTokens += effectiveOf(e);
    a.totalTokens += eventTokens(e);
    a.messageCount += 1;
    a.toolCallCount += e.tools.length;
  }
  // Inclusive of `now`, hence the `+ 1` below.
  const out: DailyActivity[] = [];
  for (const t of utc ? utcDayStarts(from, now + 1) : localDayStarts(from, now + 1)) {
    const key = keyOf(t);
    const live = map.get(key);
    if (live) {
      out.push(live);
    } else {
      const cacheAct = cacheActivityMap.get(key);
      const cacheTok = cacheTokensMap.get(key);
      if (cacheAct || cacheTok) {
        out.push({
          date: key,
          effectiveTokens: cacheTok ?? 0,
          totalTokens: cacheTok ?? 0,
          messageCount: cacheAct?.messageCount ?? 0,
          toolCallCount: cacheAct?.toolCallCount ?? 0,
        });
      } else {
        out.push({
          date: key,
          effectiveTokens: 0,
          totalTokens: 0,
          messageCount: 0,
          toolCallCount: 0,
        });
      }
    }
  }
  return { rangeFrom: from, rangeTo: now, utc, dailyActivity: out };
}

export interface UsageSummary {
  /** Earliest / latest event in the scoped history; null when there is none. */
  firstEventTs: number | null;
  lastEventTs: number | null;
  lifetimeEffectiveTokens: number;
  lifetimeTotalTokens: number;
  lifetimeCost: number;
  /** The local calendar day with the most effective tokens. */
  peakDay: { date: string; effectiveTokens: number } | null;
  /** Consecutive active local days ending today — or yesterday, while today has none yet. */
  currentStreakDays: number;
  longestStreakDays: number;
  activeDays: number;
  /** Local calendar days from the first event's day through today, inclusive. */
  spanDays: number;
}

/** The next local calendar date after `key` (YYYY-MM-DD) — calendar arithmetic, DST-safe. */
function nextDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + 1).getTime());
}

/** Local midnight `n` calendar days before the local day of `d` (n = 0: that day's midnight). */
function localMidnightBefore(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n);
}

/** "Lifetime" only reaches as far back as transcripts on disk — Claude Code deletes them after ~30 days unless the history archive is on. */
export function buildUsageSummary(events: UsageEvent[], now: number): UsageSummary {
  const perDay = new Map<string, number>();
  let first = Infinity;
  let last = -Infinity;
  let eff = 0;
  let total = 0;
  let cost = 0;
  for (const e of events) {
    if (e.ts > now) continue;
    if (e.ts < first) first = e.ts;
    if (e.ts > last) last = e.ts;
    const k = localDateKey(e.ts);
    perDay.set(k, (perDay.get(k) ?? 0) + effectiveOf(e));
    eff += effectiveOf(e);
    total += eventTokens(e);
    cost += estimateCost(e.model, e);
  }
  if (perDay.size === 0) {
    return {
      firstEventTs: null,
      lastEventTs: null,
      lifetimeEffectiveTokens: 0,
      lifetimeTotalTokens: 0,
      lifetimeCost: 0,
      peakDay: null,
      currentStreakDays: 0,
      longestStreakDays: 0,
      activeDays: 0,
      spanDays: 0,
    };
  }

  let peakDay: UsageSummary['peakDay'] = null;
  for (const [date, v] of perDay) {
    if (!peakDay || v > peakDay.effectiveTokens) peakDay = { date, effectiveTokens: v };
  }

  const keys = [...perDay.keys()].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < keys.length; i++) {
    run = keys[i] === nextDateKey(keys[i - 1]) ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Walk back from today (or yesterday, while today is still empty — the streak isn't broken until the day ends).
  const today = new Date(now);
  let back = perDay.has(localDateKey(localMidnightBefore(today, 0).getTime())) ? 0 : 1;
  let current = 0;
  while (perDay.has(localDateKey(localMidnightBefore(today, back).getTime()))) {
    current += 1;
    back += 1;
  }

  const spanDays = localDayStarts(localMidnightBefore(new Date(first), 0).getTime(), now + 1).length;

  return {
    firstEventTs: first,
    lastEventTs: last,
    lifetimeEffectiveTokens: eff,
    lifetimeTotalTokens: total,
    lifetimeCost: cost,
    peakDay,
    currentStreakDays: current,
    longestStreakDays: longest,
    activeDays: perDay.size,
    spanDays,
  };
}

export interface UsageSummaryData extends UsageSummary {
  /** Per-platform summaries — only for the unscoped (Both) request, which shows the split. */
  byPlatform?: { claude: UsageSummary; codex: UsageSummary };
}

/** Known effort levels, lowest first (Claude adds xhigh / max; Codex runs low–high). */
export const EFFORT_ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
/** Events whose log carries no effort (older Claude Code builds, older Codex rollouts). */
export const UNKNOWN_EFFORT = 'unknown';

export interface EffortSlice {
  effort: string;
  effectiveTokens: number;
  cost: number;
  messages: number;
}

/** `share` is null when nothing in the window reports reasoning tokens (older builds don't log the split); `coverage` is the fraction of output tokens it's computed over. */
export interface ReasoningShare {
  outputTokens: number;
  reportedOutputTokens: number;
  reasoningTokens: number;
  share: number | null;
  coverage: number;
}

export interface ModelEffort {
  model: string;
  effectiveTokens: number;
  cost: number;
  efforts: EffortSlice[];
  reasoning: ReasoningShare;
}

export interface EffortData {
  rangeFrom: number;
  rangeTo: number;
  efforts: EffortSlice[];
  models: ModelEffort[];
  reasoning: ReasoningShare;
}

/** Effort label as logged, normalised: lower-case, '' → UNKNOWN_EFFORT. */
export function normalizeEffort(raw: string | undefined): string {
  const v = (raw ?? '').trim().toLowerCase();
  return v || UNKNOWN_EFFORT;
}

function effortRank(effort: string): number {
  if (effort === UNKNOWN_EFFORT) return EFFORT_ORDER.length + 1;
  const i = EFFORT_ORDER.indexOf(effort);
  return i === -1 ? EFFORT_ORDER.length : i;
}

/** Lowest effort first; unrecognised levels after the known ones (by name), unknown last. */
function sortEfforts(slices: EffortSlice[]): EffortSlice[] {
  return slices.sort((a, b) => effortRank(a.effort) - effortRank(b.effort) || a.effort.localeCompare(b.effort));
}

interface ReasoningAcc {
  output: number;
  reportedOutput: number;
  reasoning: number;
}

function addReasoning(acc: ReasoningAcc, e: UsageEvent): void {
  acc.output += e.outputTokens;
  if (typeof e.reasoningTokens === 'number' && Number.isFinite(e.reasoningTokens)) {
    acc.reportedOutput += e.outputTokens;
    acc.reasoning += e.reasoningTokens;
  }
}

function reasoningShare(acc: ReasoningAcc): ReasoningShare {
  return {
    outputTokens: acc.output,
    reportedOutputTokens: acc.reportedOutput,
    reasoningTokens: acc.reasoning,
    share: acc.reportedOutput > 0 ? Math.min(1, acc.reasoning / acc.reportedOutput) : null,
    coverage: acc.output > 0 ? acc.reportedOutput / acc.output : 0,
  };
}

/** Same shape for Claude and Codex (effort levels differ), so one card serves both platforms. */
export function buildEffort(events: UsageEvent[], now: number, days: number): EffortData {
  const from = now - days * DAY;
  const overall = new Map<string, EffortSlice>();
  const overallReasoning: ReasoningAcc = { output: 0, reportedOutput: 0, reasoning: 0 };
  const perModel = new Map<string, { total: TokenTotals; efforts: Map<string, EffortSlice>; reasoning: ReasoningAcc }>();

  const bump = (m: Map<string, EffortSlice>, effort: string, e: UsageEvent, c: number) => {
    let s = m.get(effort);
    if (!s) {
      s = { effort, effectiveTokens: 0, cost: 0, messages: 0 };
      m.set(effort, s);
    }
    s.effectiveTokens += effectiveOf(e);
    s.cost += c;
    s.messages += 1;
  };

  for (const e of events) {
    if (e.ts < from || e.ts > now || e.model === '<synthetic>') continue;
    const effort = normalizeEffort(e.effort);
    const c = estimateCost(e.model, e);
    bump(overall, effort, e, c);
    addReasoning(overallReasoning, e);
    let pm = perModel.get(e.model);
    if (!pm) {
      pm = { total: emptyTotals(), efforts: new Map(), reasoning: { output: 0, reportedOutput: 0, reasoning: 0 } };
      perModel.set(e.model, pm);
    }
    add(pm.total, e);
    bump(pm.efforts, effort, e, c);
    addReasoning(pm.reasoning, e);
  }

  const models: ModelEffort[] = [...perModel.entries()]
    .filter(([, pm]) => pm.total.totalTokens > 0)
    .map(([model, pm]) => ({
      model,
      effectiveTokens: pm.total.effectiveTokens,
      cost: pm.total.cost,
      efforts: sortEfforts([...pm.efforts.values()]),
      reasoning: reasoningShare(pm.reasoning),
    }))
    .sort((a, b) => b.effectiveTokens - a.effectiveTokens);

  return {
    rangeFrom: from,
    rangeTo: now,
    efforts: sortEfforts([...overall.values()]),
    models,
    reasoning: reasoningShare(overallReasoning),
  };
}

/** Per-project cost & token breakdown derived from UsageEvents. */
export function buildProjectStats(events: UsageEvent[], now: number, days: number) {
  const from = now - days * 24 * HOUR;
  const map = new Map<string, {
    path: string;
    effectiveTokens: number;
    cost: number;
    sessionIds: Set<string>;
  }>();

  for (const e of events) {
    // Cowork sessions carry sandbox-internal paths, so they're excluded here
    // (projectPath is blank for them anyway — this is belt-and-suspenders).
    if (e.ts < from || !e.projectPath || e.source === 'cowork') continue;
    let p = map.get(e.projectPath);
    if (!p) {
      p = { path: e.projectPath, effectiveTokens: 0, cost: 0, sessionIds: new Set() };
      map.set(e.projectPath, p);
    }
    p.effectiveTokens += e.inputTokens + e.outputTokens + e.cacheCreateTokens;
    p.cost += estimateCost(e.model, e);
    if (e.sessionId) p.sessionIds.add(e.sessionId);
  }

  const projects = [...map.values()]
    .map((p) => ({
      path: p.path,
      name: p.path.split(/[\\\/]/).filter(Boolean).pop() ?? p.path,
      effectiveTokens: p.effectiveTokens,
      cost: p.cost,
      sessionCount: p.sessionIds.size,
    }))
    .sort((a, b) => b.cost - a.cost);

  return { rangeFrom: from, rangeTo: now, projects };
}

/** Peak usage heatmap: 7 rows (Mon=0..Sun=6) × 24 cols (hour 0..23),
 *  values are sum of effective tokens in that slot over the window. */
export function buildHourlyHeatmap(events: UsageEvent[], now: number, days: number) {
  const from = now - days * 24 * HOUR;
  // grid[dayOfWeek][hour] — dayOfWeek: 0=Mon..6=Sun
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

  for (const e of events) {
    if (e.ts < from) continue;
    const d = new Date(e.ts);
    // getDay(): 0=Sun,1=Mon..6=Sat → remap to Mon=0..Sun=6
    const rawDay = d.getDay();
    const dayIdx = rawDay === 0 ? 6 : rawDay - 1;
    const hourIdx = d.getHours();
    const effective = e.inputTokens + e.outputTokens + e.cacheCreateTokens;
    grid[dayIdx][hourIdx] += effective;
  }

  return { rangeFrom: from, rangeTo: now, grid };
}
