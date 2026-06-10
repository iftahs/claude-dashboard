import type { UsageEvent } from './scan.ts';
import { estimateCost } from './pricing.ts';

const HOUR = 3600_000;
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
  byModel: Record<string, number>;
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

function bucketize(events: UsageEvent[], from: number, to: number, width: number): Bucket[] {
  const buckets: Bucket[] = [];
  const start0 = Math.floor(from / width) * width;
  for (let s = start0; s < to; s += width) {
    buckets.push({ start: s, byModel: {}, byModelCost: {}, ...emptyTotals() });
  }
  for (const e of events) {
    if (e.ts < start0 || e.ts >= to) continue;
    const idx = Math.floor((e.ts - start0) / width);
    const b = buckets[idx];
    if (!b) continue;
    add(b, e);
    b.byModel[e.model] = (b.byModel[e.model] ?? 0) + eventTokens(e);
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
  return [...map.entries()]
    .map(([model, t]) => ({ model, ...t }))
    .filter((m) => m.totalTokens > 0 && m.model !== '<synthetic>')
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

function sumTotals(events: UsageEvent[]): TokenTotals {
  const t = emptyTotals();
  for (const e of events) add(t, e);
  return t;
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

/** Use the most recent sessionId to anchor the block — mirrors how Anthropic
 *  counts: each conversation/session gets its own 5h window starting at the
 *  first message in that session.
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

  const blockStart = sessionEvents[0].ts;
  const resetsAt = blockStart + BLOCK_MS;
  const isActive = now < resetsAt;

  // Previous session = the session just before the current one
  const prevSessionEvents = currentSessionId
    ? (() => {
        // Find last event not in current session
        let prevId = '';
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].sessionId !== currentSessionId) {
            prevId = events[i].sessionId;
            break;
          }
        }
        return prevId ? events.filter((e) => e.sessionId === prevId) : [];
      })()
    : [];

  const totals = sumTotals(sessionEvents);
  const prevTotals = sumTotals(prevSessionEvents);
  const byModel: Record<string, number> = {};
  for (const e of sessionEvents) byModel[e.model] = (byModel[e.model] ?? 0) + eventTokens(e);

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
    activeBlock: computeActiveBlock(events, now),
  };
}

export function buildWeekly(events: UsageEvent[], now: number, days = 7) {
  const DAY = 24 * HOUR;
  const from = now - days * DAY;
  const prevFrom = from - days * DAY;
  const windowEvents = events.filter((e) => e.ts >= from);
  const prevEvents = events.filter((e) => e.ts >= prevFrom && e.ts < from);

  // Cache efficiency per day
  const dayBuckets = bucketize(windowEvents, from, now, DAY);
  const cacheEfficiency = dayBuckets
    .filter((b) => b.totalTokens > 0)
    .map((b) => ({
      date: new Date(b.start).toISOString().slice(0, 10),
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
    cacheEfficiency,
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

export interface DailyActivity {
  date: string; // local YYYY-MM-DD
  effectiveTokens: number;
  messageCount: number;
  toolCallCount: number;
}

/** Daily activity derived live from JSONL events (always current, unlike the
 *  stale stats-cache.json). Fills every day in the window so the heatmap is dense. */
export function buildActivity(events: UsageEvent[], now: number, days: number, stats?: any) {
  const DAY = 24 * HOUR;
  const map = new Map<string, DailyActivity>();
  const from = now - days * DAY;

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
    const key = localDateKey(e.ts);
    let a = map.get(key);
    if (!a) {
      a = { date: key, effectiveTokens: 0, messageCount: 0, toolCallCount: 0 };
      map.set(key, a);
    }
    a.effectiveTokens += e.inputTokens + e.outputTokens + e.cacheCreateTokens;
    a.messageCount += 1;
    a.toolCallCount += e.tools.length;
  }
  // Emit one entry per day in [from, now], including empty days.
  const out: DailyActivity[] = [];
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  for (let t = start.getTime(); t <= now; t += DAY) {
    const key = localDateKey(t);
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
          messageCount: cacheAct?.messageCount ?? 0,
          toolCallCount: cacheAct?.toolCallCount ?? 0,
        });
      } else {
        out.push({
          date: key,
          effectiveTokens: 0,
          messageCount: 0,
          toolCallCount: 0,
        });
      }
    }
  }
  return { rangeFrom: from, rangeTo: now, dailyActivity: out };
}

export interface ToolShare {
  name: string;
  count: number;
}

/** Tool-usage breakdown over a window, derived live from JSONL events. */
export function buildTools(events: UsageEvent[], now: number, days: number) {
  const from = now - days * 24 * HOUR;
  const counts = new Map<string, number>();
  let totalCalls = 0;
  for (const e of events) {
    if (e.ts < from) continue;
    for (const name of e.tools) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
      totalCalls += 1;
    }
  }
  const tools: ToolShare[] = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  return { rangeFrom: from, rangeTo: now, totalCalls, tools };
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
    if (e.ts < from || !e.projectPath) continue;
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
