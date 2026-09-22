import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchCodexUsage, readPassiveRateLimits, snapshotFromLines } from './codex-live.ts';

// Synthetic token_count snapshots only.
const NOW = Date.parse('2026-09-22T20:00:00.000Z');
const sec = (ms: number) => Math.floor(ms / 1000);
const HOUR = 3600_000;

interface Win { used_percent: number; window_minutes: number; resets_at: number }
const fiveHour = (used: number, now = NOW): Win => ({ used_percent: used, window_minutes: 300, resets_at: sec(now + 2 * HOUR) });
const weekly = (used: number, now = NOW): Win => ({ used_percent: used, window_minutes: 10080, resets_at: sec(now + 3 * 24 * HOUR) });

function tokenCount(atMs: number, rateLimits: object): string {
  return JSON.stringify({
    timestamp: new Date(atMs).toISOString(),
    type: 'event_msg',
    payload: { type: 'token_count', info: null, rate_limits: rateLimits },
  });
}
const codexLimits = (primary: Win | null, secondary: Win | null, extra: object = {}) =>
  ({ limit_id: 'codex', primary, secondary, credits: null, plan_type: 'plus', rate_limit_reached_type: null, ...extra });
const premiumLimits = () =>
  ({ limit_id: 'premium', primary: null, secondary: null, credits: null, plan_type: 'plus', rate_limit_reached_type: null });

test('a trailing premium snapshot is skipped for the codex one before it', () => {
  const lines = [
    tokenCount(NOW - 10 * 60_000, codexLimits(fiveHour(40), weekly(70))),
    tokenCount(NOW - 5 * 60_000, codexLimits(fiveHour(100), weekly(77))),
    tokenCount(NOW - 5 * 60_000 + 10, premiumLimits()), // written ms before a usage-limit error
    '',
  ];
  const snap = snapshotFromLines(lines, NOW);
  assert.ok(snap);
  assert.equal(snap.origin, 'passive');
  assert.equal(snap.fiveHour?.usedPct, 100);
  assert.equal(snap.weekly?.usedPct, 77);
  assert.equal(snap.snapshotAt, new Date(NOW - 5 * 60_000).toISOString());
  assert.equal(snap.limitReached, true, 'an open window at 100% is a reached limit');
  assert.equal(snap.error, undefined);
});

test('only premium snapshots → null; a missing limit_id counts as codex', () => {
  assert.equal(snapshotFromLines([tokenCount(NOW, premiumLimits())], NOW), null);

  const legacy = codexLimits(fiveHour(12), weekly(34));
  delete (legacy as { limit_id?: string }).limit_id;
  const snap = snapshotFromLines([tokenCount(NOW, legacy)], NOW);
  assert.equal(snap?.fiveHour?.usedPct, 12);
  assert.equal(snap?.limitReached, false);
});

test('a lapsed window reads 0% with no reset; an absent window stays null', () => {
  // 'go'-style plan: a weekly primary and no secondary. The weekly reset passed after the snapshot.
  const lapsedWeekly = { used_percent: 100, window_minutes: 10080, resets_at: sec(NOW - HOUR) };
  const snap = snapshotFromLines([tokenCount(NOW - 2 * HOUR, codexLimits(lapsedWeekly, null))], NOW);
  assert.ok(snap);
  assert.equal(snap.fiveHour, null);
  assert.deepEqual(snap.weekly, { usedPct: 0, windowSec: 604800, resetsAt: null });
  assert.equal(snap.limitReached, false, 'a reached flag on a lapsed window says nothing about now');
});

test('passive fallback: newest rollout by last record, falling through premium-only tails; warning, never error', async () => {
  // readPassiveRateLimits reads the real clock, so these windows must still be open now.
  const now = Date.now();
  const root = mkdtempSync(join(tmpdir(), 'codex-live-test-'));
  const prevDir = process.env.CODEX_DIR;
  try {
    const day = join(root, 'sessions', '2026', '09', '22');
    mkdirSync(day, { recursive: true });
    // Newest by last record, but its tail holds only a premium snapshot.
    writeFileSync(
      join(day, 'rollout-2026-09-22T19-00-00-00000000-0000-4000-8000-000000000001.jsonl'),
      tokenCount(now - 60_000, premiumLimits()) + '\n',
    );
    writeFileSync(
      join(day, 'rollout-2026-09-22T18-00-00-00000000-0000-4000-8000-000000000002.jsonl'),
      tokenCount(now - 30 * 60_000, codexLimits(fiveHour(55, now), weekly(66, now))) + '\n',
    );
    process.env.CODEX_DIR = root; // no auth.json here → live is skipped, no network call

    const snap = await readPassiveRateLimits();
    assert.equal(snap?.fiveHour?.usedPct, 55);
    assert.equal(snap?.weekly?.usedPct, 66);

    const data = await fetchCodexUsage();
    assert.equal(data.origin, 'passive');
    assert.equal(data.error, undefined, 'passive data must stay renderable');
    assert.match(data.warning ?? '', /live usage unavailable: No Codex login found/);
    assert.equal(data.fiveHour?.usedPct, 55);
  } finally {
    if (prevDir === undefined) delete process.env.CODEX_DIR;
    else process.env.CODEX_DIR = prevDir;
    rmSync(root, { recursive: true, force: true });
  }
});
