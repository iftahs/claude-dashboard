import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { UsageEvent } from './scan.ts';
import {
  buildEffort, buildModels, buildUsageSummary, buildWeekly, normalizeEffort, UNKNOWN_EFFORT,
} from './aggregate.ts';

// Synthetic fixtures only. Trends/Models builders: per-model effective buckets,
// the Codex thread/guardian split, UTC activity, the lifetime summary and the
// reasoning-effort breakdown.

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

/** Local noon `daysAgo` calendar days before `now`'s day (DST-safe). */
function localNoon(now: number, daysAgo: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysAgo, 12).getTime();
}

test('daily buckets carry effective tokens per model; totals keep cache reads', () => {
  const now = new Date(2026, 8, 20, 18).getTime();
  const events = [
    ev(localNoon(now, 1), { model: 'a', inputTokens: 10, outputTokens: 5, cacheCreateTokens: 2, cacheReadTokens: 1000 }),
    ev(localNoon(now, 1) + HOUR, { model: 'b', inputTokens: 1, outputTokens: 1, cacheCreateTokens: 0, cacheReadTokens: 50 }),
  ];
  const w = buildWeekly(events, now, 7);
  const day = w.buckets.find((b) => b.effectiveTokens > 0)!;
  assert.deepEqual(day.byModelEffective, { a: 17, b: 2 });
  assert.deepEqual(day.byModel, { a: 1017, b: 52 }, 'byModel stays total tokens (tooltip)');
  const sum = Object.values(day.byModelEffective).reduce((x, y) => x + y, 0);
  assert.equal(sum, day.effectiveTokens, 'per-model effective sums to the bucket effective');
});

test('model shares rank by effective tokens, not cache-read-heavy totals', () => {
  const now = new Date(2026, 8, 20, 18).getTime();
  const events = [
    // "reader": few effective tokens, a huge cache-read total.
    ev(now - HOUR, { model: 'reader', inputTokens: 10, outputTokens: 0, cacheReadTokens: 1_000_000 }),
    ev(now - HOUR, { model: 'writer', inputTokens: 5000, outputTokens: 500, cacheReadTokens: 0 }),
  ];
  assert.deepEqual(buildModels(events, now, 7).models.map((m) => m.model), ['writer', 'reader']);
});

test('weekly codexSplit separates threads from guardian reviews and ignores Claude events', () => {
  const now = new Date(2026, 8, 20, 18).getTime();
  const events = [
    ev(now - HOUR, { source: 'codex', model: 'gpt-6-sol', inputTokens: 100, outputTokens: 20 }),
    ev(now - HOUR, { source: 'codex', model: 'codex-auto-review', attributionAgent: 'guardian_review', inputTokens: 30, outputTokens: 3 }),
    ev(now - HOUR, { source: 'code', inputTokens: 999, outputTokens: 1 }),
  ];
  const { codexSplit } = buildWeekly(events, now, 7);
  assert.equal(codexSplit.threads.effectiveTokens, 120);
  assert.equal(codexSplit.guardian.effectiveTokens, 33);
});

/** Run `body` in a child process with TZ set (the parent's TZ is fixed once Node starts). */
function inTimeZone(tz: string, body: string): any {
  const code = `
    const m = await import(${JSON.stringify(AGGREGATE_URL)});
    const ev = (ts, over = {}) => ({
      ts, sessionId: 's', model: 'gpt-6-sol', inputTokens: 10, outputTokens: 1, cacheCreateTokens: 0,
      cacheReadTokens: 100, tools: [], isSidechain: false, rootSessionId: 's', attributionAgent: '',
      attributionSkill: '', attributionMcpServer: '', attributionPlugin: '', projectPath: '', gitBranch: '',
      source: 'codex', ...over,
    });
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

test('activity ?utc buckets by UTC day with total tokens, whatever the local zone', () => {
  const r = inTimeZone(
    'Asia/Jerusalem',
    `
    // 22:30 UTC on Sep 21 is already Sep 22 in Jerusalem (UTC+3).
    const t = Date.UTC(2026, 8, 21, 22, 30);
    const now = Date.UTC(2026, 8, 23, 6);
    const stats = { dailyActivity: [{ date: '2026-09-20', messageCount: 7, toolCallCount: 1 }] };
    const utc = m.buildActivity([ev(t)], now, 7, stats, { utc: true });
    const local = m.buildActivity([ev(t)], now, 7);
    out = {
      utc: utc.dailyActivity.filter((d) => d.totalTokens > 0 || d.messageCount > 0),
      utcDays: utc.dailyActivity.map((d) => d.date),
      local: local.dailyActivity.filter((d) => d.totalTokens > 0).map((d) => d.date),
    };
    `,
  );
  assert.deepEqual(r.utc, [
    { date: '2026-09-21', effectiveTokens: 11, totalTokens: 111, messageCount: 1, toolCallCount: 0 },
  ], 'UTC key, all tokens counted, and no stats-cache day');
  assert.equal(r.utcDays.at(-1), '2026-09-23', 'the window ends on today (UTC)');
  assert.equal(new Set(r.utcDays).size, r.utcDays.length, 'one entry per UTC day');
  assert.deepEqual(r.local, ['2026-09-22'], 'the default stays the local calendar day');
});

test('summary: lifetime totals, peak day, active days, span and streaks', () => {
  const now = new Date(2026, 8, 20, 9).getTime(); // before today's first message
  const events = [
    ev(localNoon(now, 10), { inputTokens: 50, outputTokens: 0 }), // first day
    // a 3-day run, 6–4 days ago
    ev(localNoon(now, 6)),
    ev(localNoon(now, 5), { inputTokens: 5000, outputTokens: 0 }), // peak
    ev(localNoon(now, 4)),
    // current run: 2 and 1 days ago; today has nothing yet
    ev(localNoon(now, 2)),
    ev(localNoon(now, 1)),
  ];
  const s = buildUsageSummary(events, now);
  assert.equal(s.firstEventTs, localNoon(now, 10));
  assert.equal(s.lifetimeEffectiveTokens, 50 + 5000 + 110 * 4);
  assert.equal(s.activeDays, 6);
  assert.equal(s.spanDays, 11, 'first day through today, inclusive');
  assert.equal(s.longestStreakDays, 3);
  assert.equal(s.currentStreakDays, 2, 'an empty today does not break the streak yet');
  const peak = new Date(localNoon(now, 5));
  assert.equal(s.peakDay?.effectiveTokens, 5000);
  assert.equal(s.peakDay?.date, `${peak.getFullYear()}-${String(peak.getMonth() + 1).padStart(2, '0')}-${String(peak.getDate()).padStart(2, '0')}`);

  // A gap yesterday ends the current streak.
  assert.equal(buildUsageSummary([ev(localNoon(now, 2))], now).currentStreakDays, 0);
  // Activity today counts from today.
  assert.equal(buildUsageSummary([ev(localNoon(now, 1)), ev(now - HOUR)], now).currentStreakDays, 2);
});

test('summary of an empty history is all zeros with null dates', () => {
  const s = buildUsageSummary([], Date.now());
  assert.equal(s.firstEventTs, null);
  assert.equal(s.peakDay, null);
  assert.equal(s.activeDays + s.spanDays + s.currentStreakDays + s.longestStreakDays, 0);
});

test('streaks count calendar days across a DST change', () => {
  const r = inTimeZone(
    'America/New_York',
    `
    // 2026-11-01 is the US fall-back day (25 h long): Oct 31, Nov 1, Nov 2 are
    // three consecutive calendar days even though they are not 3 × 24 h apart.
    const noon = (mo, d) => new Date(2026, mo, d, 12).getTime();
    const s = m.buildUsageSummary([ev(noon(9, 31)), ev(noon(10, 1)), ev(noon(10, 2))], new Date(2026, 10, 2, 18).getTime());
    out = { current: s.currentStreakDays, longest: s.longestStreakDays, span: s.spanDays };
    `,
  );
  assert.deepEqual(r, { current: 3, longest: 3, span: 3 });
});

test('effort: normalised, ordered low→max with unknown last, per model and overall', () => {
  const now = new Date(2026, 8, 20, 18).getTime();
  const t = now - HOUR;
  const events = [
    ev(t, { model: 'm1', effort: 'XHigh' }),
    ev(t, { model: 'm1', effort: 'medium' }),
    ev(t, { model: 'm1' }), // no effort logged
    ev(t, { model: 'm2', effort: 'max', inputTokens: 1000 }),
    ev(t, { model: 'm2', effort: 'low' }),
    ev(t, { model: '<synthetic>', effort: 'high' }),
    ev(now - 30 * 24 * HOUR, { model: 'm3', effort: 'high' }), // outside the window
  ];
  const d = buildEffort(events, now, 7);
  assert.deepEqual(d.efforts.map((s) => s.effort), ['low', 'medium', 'xhigh', 'max', UNKNOWN_EFFORT]);
  assert.deepEqual(d.models.map((m) => m.model), ['m2', 'm1'], 'ranked by effective tokens; synthetic and out-of-window dropped');
  assert.deepEqual(d.models[1].efforts.map((s) => [s.effort, s.effectiveTokens, s.messages]), [
    ['medium', 110, 1],
    ['xhigh', 110, 1],
    [UNKNOWN_EFFORT, 110, 1],
  ]);
  assert.equal(normalizeEffort(''), UNKNOWN_EFFORT);
  assert.equal(normalizeEffort(undefined), UNKNOWN_EFFORT);
});

test('reasoning share counts only responses that report it (n/a, never 0%)', () => {
  const now = new Date(2026, 8, 20, 18).getTime();
  const t = now - HOUR;
  const d = buildEffort(
    [
      ev(t, { model: 'old', outputTokens: 100, reasoningTokens: null }), // unreported
      ev(t, { model: 'new', outputTokens: 100, reasoningTokens: 40 }),
      ev(t, { model: 'new', outputTokens: 100, reasoningTokens: 0 }), // reported, no thinking
      ev(t, { model: 'new', outputTokens: 200 }), // field absent = unreported
    ],
    now,
    7,
  );
  const byModel = Object.fromEntries(d.models.map((m) => [m.model, m.reasoning]));
  assert.equal(byModel.old.share, null, 'nothing reported → null, not 0');
  assert.equal(byModel.old.coverage, 0);
  assert.equal(byModel.new.share, 40 / 200);
  assert.equal(byModel.new.coverage, 200 / 400);
  assert.equal(d.reasoning.share, 40 / 200);
  assert.equal(d.reasoning.coverage, 200 / 500);
});
