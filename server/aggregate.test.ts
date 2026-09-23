import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { UsageEvent } from './scan.ts';
import {
  buildActivity, buildRecent, buildWeekly, filterSource, localDayStarts, statsCacheApplies, type SourceFilter,
} from './aggregate.ts';

const HOUR = 3600_000;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AGGREGATE_URL = pathToFileURL(join(ROOT, 'server', 'aggregate.ts')).href;

function ev(ts: number, over: Partial<UsageEvent> = {}): UsageEvent {
  return {
    ts,
    sessionId: 's1',
    model: 'claude-sonnet-4-5',
    inputTokens: 100,
    outputTokens: 10,
    cacheCreateTokens: 0,
    cacheReadTokens: 0,
    tools: [],
    isSidechain: false,
    rootSessionId: 's1',
    attributionAgent: '',
    attributionSkill: '',
    attributionMcpServer: '',
    attributionPlugin: '',
    projectPath: '',
    gitBranch: '',
    source: 'code',
    ...over,
  };
}

/**
 * The process TZ can't be switched reliably once Node has started, so DST cases run
 * in a child with TZ set. `body` sees the aggregate module as `m` and an `ev(y, mo,
 * d, h, min)` helper building a one-token event at that *local* time; whatever it
 * assigns to `out` comes back parsed.
 */
function inTimeZone(tz: string, body: string): any {
  const code = `
    const m = await import(${JSON.stringify(AGGREGATE_URL)});
    const ev = (y, mo, d, h, min = 0) => ({
      ts: new Date(y, mo, d, h, min).getTime(), sessionId: 's', model: 'claude-sonnet-4-5',
      inputTokens: 1, outputTokens: 0, cacheCreateTokens: 0, cacheReadTokens: 0, tools: [],
      isSidechain: false, rootSessionId: 's', attributionAgent: '', attributionSkill: '',
      attributionMcpServer: '', attributionPlugin: '', projectPath: '', gitBranch: '', source: 'code',
    });
    const local = (ms) => {
      const d = new Date(ms);
      const p = (n) => String(n).padStart(2, '0');
      return { date: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), h: d.getHours(), min: d.getMinutes() };
    };
    let out;
    ${body}
    process.stdout.write(JSON.stringify(out));
  `;
  const stdout = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
    cwd: ROOT,
    env: { ...process.env, TZ: tz },
  });
  return JSON.parse(stdout.toString());
}

/** `count` consecutive calendar dates ending on `last` (YYYY-MM-DD). */
function datesEndingOn(last: string, count: number): string[] {
  const [y, m, d] = last.split('-').map(Number);
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(y, m - 1, d - (count - 1 - i))).toISOString().slice(0, 10),
  );
}

test('stats-cache backfill applies only to filters that include Claude Code', () => {
  const expected: Record<SourceFilter, boolean> = { all: true, claude: true, code: true, cowork: false, codex: false };
  for (const [source, applies] of Object.entries(expected)) {
    assert.equal(statsCacheApplies(source as SourceFilter), applies, source);
  }
});

test('Codex and Cowork activity never shows stats-cache days as their own', () => {
  const now = new Date(2026, 5, 20, 12).getTime();
  const key = '2026-06-15'; // a day with stats-cache history but no live events
  const stats = {
    dailyActivity: [{ date: key, messageCount: 95, toolCallCount: 61 }],
    dailyModelTokens: [{ date: key, tokensByModel: { 'claude-opus-4-8': 42_556 } }],
  };
  const events = [
    ev(new Date(2026, 5, 19, 10).getTime(), { source: 'codex', model: 'gpt-6-sol' }),
    ev(new Date(2026, 5, 19, 11).getTime(), { source: 'cowork' }),
  ];
  // Mirrors the /api/activity route: filter, then pass stats only when it applies.
  const day = (source: SourceFilter) =>
    buildActivity(filterSource(events, source), now, 14, statsCacheApplies(source) ? stats : undefined)
      .dailyActivity.find((d) => d.date === key);

  for (const source of ['codex', 'cowork'] as const) {
    assert.deepEqual(day(source), { date: key, effectiveTokens: 0, messageCount: 0, toolCallCount: 0 }, source);
  }
  for (const source of ['all', 'claude', 'code'] as const) {
    assert.deepEqual(day(source), { date: key, effectiveTokens: 42_556, messageCount: 95, toolCallCount: 61 }, source);
  }
});

test('daily buckets stay one per local date across the US fall-back (2026-11-01)', () => {
  const r = inTimeZone('America/New_York', `
    const events = [ev(2026, 10, 1, 23, 30), ev(2026, 10, 2, 0, 30), ev(2026, 10, 4, 9)];
    const now = new Date(2026, 10, 4, 12).getTime();
    const weekly = m.buildWeekly(events, now, 7);
    out = {
      weekly: weekly.buckets.map((b) => ({ ...local(b.start), tokens: b.totalTokens })),
      activity: m.buildActivity(events, now, 7).dailyActivity.map((d) => ({ date: d.date, tokens: d.effectiveTokens })),
    };
  `);
  const dates = datesEndingOn('2026-11-04', 8);
  assert.deepEqual(r.weekly.map((b: any) => b.date), dates);
  for (const b of r.weekly) assert.deepEqual([b.h, b.min], [0, 0], `${b.date} starts at local midnight`);
  const tokens = (rows: any[], date: string) => rows.find((b) => b.date === date).tokens;
  assert.equal(tokens(r.weekly, '2026-11-01'), 1, '23:30 on the 25 h day stays on Nov 1');
  assert.equal(tokens(r.weekly, '2026-11-02'), 1, '00:30 lands on Nov 2, not in a bucket starting 23:00');
  assert.equal(tokens(r.weekly, '2026-11-04'), 1, 'today still has its own bucket');

  assert.deepEqual(r.activity.map((d: any) => d.date), dates, 'no repeated date, and today is not dropped');
  assert.equal(tokens(r.activity, '2026-11-04'), 1);
});

test('daily buckets stay one per local date across the US spring-forward (2026-03-08)', () => {
  const r = inTimeZone('America/New_York', `
    const events = [ev(2026, 2, 8, 12), ev(2026, 2, 10, 0, 30), ev(2026, 2, 12, 23, 30)];
    const now = new Date(2026, 2, 13, 12).getTime();
    const weekly = m.buildWeekly(events, now, 7);
    out = {
      weekly: weekly.buckets.map((b) => ({ ...local(b.start), tokens: b.totalTokens })),
      activity: m.buildActivity(events, now, 7).dailyActivity.map((d) => d.date),
    };
  `);
  const dates = datesEndingOn('2026-03-13', 8);
  assert.deepEqual(r.weekly.map((b: any) => b.date), dates);
  for (const b of r.weekly) assert.deepEqual([b.h, b.min], [0, 0], `${b.date} starts at local midnight`);
  const tokens = (date: string) => r.weekly.find((b: any) => b.date === date).tokens;
  assert.equal(tokens('2026-03-08'), 1);
  assert.equal(tokens('2026-03-09'), 0);
  assert.equal(tokens('2026-03-10'), 1, '00:30 is not pushed into the previous day by a 01:00 bucket start');
  assert.equal(tokens('2026-03-12'), 1);
  assert.deepEqual(r.activity, dates);
});

test('a non-finite window yields no day buckets instead of looping forever', () => {
  const now = Date.UTC(2026, 8, 23, 12);
  assert.deepEqual(localDayStarts(NaN, now), []);
  assert.deepEqual(localDayStarts(now - 86_400_000, NaN), []);
  assert.deepEqual(localDayStarts(now, now - 1), []);
  // ?days=abc once reached these builders as NaN and never returned.
  assert.deepEqual(buildWeekly([ev(now - HOUR)], now, NaN).buckets, []);
  assert.deepEqual(buildActivity([ev(now - HOUR)], now, NaN).dailyActivity, []);
  assert.equal(buildWeekly([ev(now - HOUR)], now, 7).buckets.length, 8);
});

test('hourly buckets are unchanged: contiguous epoch hours', () => {
  const now = Date.UTC(2026, 10, 1, 8, 20);
  const { buckets } = buildRecent([ev(now - 90 * 60_000)], now, 5);
  assert.equal(buckets[0].start, Math.floor((now - 5 * HOUR) / HOUR) * HOUR);
  for (let i = 1; i < buckets.length; i++) assert.equal(buckets[i].start - buckets[i - 1].start, HOUR);
  assert.equal(buckets.reduce((n, b) => n + b.totalTokens, 0), 110);
});

test('activeBlock.isActive flips exactly at resetsAt, relative to the passed now', () => {
  const t0 = Date.UTC(2026, 8, 20, 9);
  const events = [
    ev(t0 - 8 * HOUR, { sessionId: 'prev' }),
    ev(t0, { sessionId: 'cur' }),
    ev(t0 + HOUR, { sessionId: 'cur' }),
  ];
  const at = (now: number, evs: UsageEvent[] = events) => buildRecent(evs, now, 12).activeBlock;

  const live = at(t0 + 5 * HOUR - 1);
  assert.equal(live.start, t0);
  assert.equal(live.resetsAt, t0 + 5 * HOUR);
  assert.equal(live.isActive, true);
  assert.equal(live.totals.effectiveTokens, 220);
  assert.equal(live.prevTotals.effectiveTokens, 110);

  const lapsed = at(t0 + 5 * HOUR);
  assert.equal(lapsed.isActive, false);
  // The shape is kept: the lapsed session's totals are still returned, so the UI
  // must honour isActive (or resetsAt <= now) itself.
  assert.equal(lapsed.totals.effectiveTokens, 220);

  const withCodex = [...events, ev(t0 + 2 * HOUR, { sessionId: 'codex-thread', source: 'codex' })];
  assert.equal(at(t0 + 3 * HOUR, withCodex).start, t0, 'a trailing Codex event never anchors the Claude block');

  const idle = at(t0, []);
  assert.equal(idle.isActive, false);
  assert.equal(idle.resetsAt, t0 + 5 * HOUR);
});
