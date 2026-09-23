import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UsageEvent } from './scan.ts';
import type { LimitHitRow } from './scan-pass.ts';
import { buildLimitHits, buildRecent, computeCodexBlock } from './aggregate.ts';
import { buildContributors } from './contributors.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 8, 22, 12, 0, 0);

function ev(ts: number, over: Partial<UsageEvent> = {}): UsageEvent {
  return {
    ts,
    sessionId: 'thread-1',
    model: 'gpt-6-sol',
    inputTokens: 100,
    outputTokens: 10,
    cacheCreateTokens: 0,
    cacheReadTokens: 1000,
    tools: [],
    isSidechain: false,
    rootSessionId: 'thread-1',
    attributionAgent: '',
    attributionSkill: '',
    attributionMcpServer: '',
    attributionPlugin: '',
    projectPath: '',
    gitBranch: '',
    source: 'codex',
    ...over,
  };
}

const iso = (ms: number) => new Date(ms).toISOString();

// ── computeCodexBlock ───────────────────────────────────────────────────────

test('codex block: a live 5-hour window starts at reset − 5h and counts every thread inside it', () => {
  const resetsAt = NOW + 2 * HOUR; // window opened 3h ago
  const events = [
    ev(NOW - 7 * HOUR), // before the previous window
    ev(NOW - 5 * HOUR, { sessionId: 'thread-0' }), // previous window [now-8h, now-3h)
    ev(NOW - 2 * HOUR, { sessionId: 'thread-2', model: 'gpt-6-astra' }),
    ev(NOW - 10 * MIN),
  ];
  const b = computeCodexBlock(events, {
    fiveHour: { windowSec: 18000, resetsAt: iso(resetsAt) },
    weekly: { windowSec: 604800, resetsAt: iso(NOW + 3 * DAY) },
    origin: 'live',
  }, NOW);
  assert.equal(b.anchor, 'live');
  assert.equal(b.windowSec, 18000);
  assert.equal(b.start, resetsAt - 5 * HOUR);
  assert.equal(b.resetsAt, resetsAt);
  assert.equal(b.isActive, true);
  assert.equal(b.totals.effectiveTokens, 2 * 110, 'two events in the window, across two threads');
  assert.equal(b.prevTotals.effectiveTokens, 2 * 110, 'the 5h stretch before the window');
  assert.deepEqual(Object.keys(b.byModel).sort(), ['gpt-6-astra', 'gpt-6-sol']);
});

test('codex block: the weekly window is used when the plan has no 5-hour window', () => {
  const resetsAt = NOW + 2 * DAY;
  const b = computeCodexBlock([ev(NOW - 3 * DAY), ev(NOW - 6 * DAY)], {
    fiveHour: null,
    weekly: { windowSec: 604800, resetsAt: iso(resetsAt) },
    origin: 'passive',
  }, NOW);
  assert.equal(b.anchor, 'passive');
  assert.equal(b.windowSec, 604800);
  assert.equal(b.start, resetsAt - 7 * DAY);
  assert.equal(b.totals.effectiveTokens, 110, 'only the event after the window opened');
  assert.equal(b.prevTotals.effectiveTokens, 110);
});

test('codex block: without a reset time windows roll locally from the first Codex event', () => {
  const t0 = NOW - 12 * HOUR;
  const events = [ev(t0), ev(t0 + HOUR), ev(t0 + 6 * HOUR), ev(NOW - 30 * MIN)];
  // No live data at all (usage threw) → 5h local windows: [t0, t0+5h) and [t0+6h, t0+11h), then NOW-30m opens a third.
  const b = computeCodexBlock(events, null, NOW);
  assert.equal(b.anchor, 'local');
  assert.equal(b.windowSec, 18000);
  assert.equal(b.start, NOW - 30 * MIN);
  assert.equal(b.isActive, true);
  assert.equal(b.totals.effectiveTokens, 110);
  assert.equal(b.prevTotals.effectiveTokens, 110, 'the window before is the one opened at t0+6h');

  // A lapsed window (reset null) with its length known rolls by that length.
  const lapsed = computeCodexBlock(events, { fiveHour: { windowSec: 18000, resetsAt: null }, weekly: null, origin: 'passive' }, NOW);
  assert.equal(lapsed.anchor, 'local');
  assert.equal(lapsed.start, NOW - 30 * MIN);
});

test('codex block: a stale reset in the past falls back to the local anchor, and no events is idle', () => {
  const stale = computeCodexBlock([ev(NOW - 7 * HOUR)], {
    fiveHour: { windowSec: 18000, resetsAt: iso(NOW - MIN) },
    weekly: null,
    origin: 'live',
  }, NOW);
  assert.equal(stale.anchor, 'local');
  assert.equal(stale.isActive, false, 'the only local window ended 2h ago');
  assert.equal(stale.totals.effectiveTokens, 110);

  const idle = computeCodexBlock([], null, NOW);
  assert.equal(idle.isActive, false);
  assert.equal(idle.totals.totalTokens, 0);
});

test('codex events still never anchor the Claude block', () => {
  const claude = ev(NOW - 2 * HOUR, { source: 'code', sessionId: 'c1', rootSessionId: 'c1', model: 'claude-sonnet-4-5' });
  const r = buildRecent([claude, ev(NOW - MIN)], NOW, 12);
  assert.equal(r.activeBlock.start, claude.ts);
  assert.equal(r.activeBlock.totals.effectiveTokens, 110);
});

// ── buildLimitHits ──────────────────────────────────────────────────────────

function hit(ts: number, over: Partial<LimitHitRow> = {}): LimitHitRow {
  return { key: `k${ts}`, ts, sessionId: 's', source: 'code', kind: 'session', model: 'claude-opus-5', resetsAt: null, ...over };
}

test('limit hits: retries until the reset are one episode; a refusal after it opens the next', () => {
  const reset1 = NOW - 20 * HOUR;
  const hits = [
    hit(NOW - 23 * HOUR, { resetsAt: reset1 }),
    hit(NOW - 22 * HOUR, { resetsAt: reset1 }),
    hit(NOW - 21 * HOUR, { resetsAt: reset1 }),
    hit(NOW - 2 * HOUR, { resetsAt: NOW + HOUR }), // new episode, still blocked
    hit(NOW - HOUR, { resetsAt: NOW + HOUR }),
  ];
  const s = buildLimitHits(hits, NOW, 30);
  assert.equal(s.episodes7d, 2);
  assert.equal(s.requests7d, 5);
  assert.equal(s.episodes[0].start, NOW - 2 * HOUR, 'newest first');
  assert.equal(s.episodes[0].requests, 2);
  assert.equal(s.episodes[1].requests, 3);
  assert.equal(s.active?.start, NOW - 2 * HOUR, 'the limit has not lifted yet');
});

test('limit hits: no reset time groups refusals within an hour of each other; kinds and sources stay apart', () => {
  const hits = [
    hit(NOW - 5 * HOUR),
    hit(NOW - 5 * HOUR + 30 * MIN), // same episode (within 1h of the last)
    hit(NOW - 3 * HOUR), // > 1h after the last → new episode
    hit(NOW - 3 * HOUR, { kind: 'model', model: 'claude-fable-5-1' }), // a per-model cap is its own episode
    hit(NOW - 3 * HOUR, { source: 'codex', model: 'gpt-6-sol' }),
  ];
  const s = buildLimitHits(hits, NOW, 30);
  assert.equal(s.episodes30d, 4);
  assert.equal(s.requests30d, 5);
  assert.equal(s.active, null);
  assert.deepEqual(new Set(s.episodes.map((e) => e.source)), new Set(['code', 'codex']));
});

test('limit hits: Code and Cowork refusals of the one Claude limit are one episode', () => {
  const resetsAt = NOW + HOUR;
  const s = buildLimitHits([
    hit(NOW - 30 * MIN, { resetsAt }),
    hit(NOW - 20 * MIN, { source: 'cowork', model: '', resetsAt }),
  ], NOW, 30);
  assert.equal(s.episodes30d, 1);
  assert.equal(s.episodes[0].requests, 2);
  assert.equal(s.episodes[0].source, 'code', 'the episode keeps its first refusal’s surface');
});

test('limit hits: 7d/30d counts ignore the list window; the list honours `days`', () => {
  const hits = [hit(NOW - 20 * DAY), hit(NOW - 3 * DAY), hit(NOW - 40 * DAY)];
  const s = buildLimitHits(hits, NOW, 7);
  assert.equal(s.episodes7d, 1);
  assert.equal(s.episodes30d, 2);
  assert.equal(s.episodes.length, 1);
  assert.equal(s.rangeFrom, NOW - 7 * DAY);
});

// ── buildContributors: Codex weighting and copy ─────────────────────────────

test('contributors: Codex shares are effective-token weighted, so $0 Guardian reviews show up', () => {
  const parent = ev(NOW - HOUR, { inputTokens: 300, outputTokens: 0, cacheReadTokens: 0 });
  const guardian = ev(NOW - HOUR + MIN, {
    model: 'codex-auto-review', inputTokens: 100, outputTokens: 0, cacheReadTokens: 0,
    isSidechain: true, attributionAgent: 'guardian_review',
  });
  const d = buildContributors([parent, guardian], NOW);
  assert.equal(d.weight, 'effectiveTokens');
  assert.deepEqual(d.day.subagents, [{ name: 'guardian_review', pct: 25 }]);
  const heavy = d.day.behaviors.find((b) => b.key === 'subagent_heavy');
  assert.ok(heavy, 'the whole thread ran auto-reviews');
  assert.equal(heavy.pct, 100);
  for (const b of d.day.behaviors) {
    assert.doesNotMatch(`${b.headline} ${b.body}`, /\/compact|\/clear|Claude|session/i);
  }
});

test('contributors: Claude input keeps cost weighting and the CLI copy', () => {
  const e = ev(NOW - HOUR, {
    source: 'code', model: 'claude-sonnet-4-5', sessionId: 'c', rootSessionId: 'c',
    inputTokens: 200_000, cacheReadTokens: 0,
  });
  const d = buildContributors([e], NOW);
  assert.equal(d.weight, 'cost');
  const ctx = d.day.behaviors.find((b) => b.key === 'long_context');
  assert.ok(ctx);
  assert.match(ctx.body, /\/compact/);
});
