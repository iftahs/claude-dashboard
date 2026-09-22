import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoBuilder } from './builder-cache.ts';
import { canReuseMerge, memoToken, type MergeBasis } from './data.ts';

const MINUTE = 60_000;
/** An exact minute boundary; the clock is injected, never read. */
const T0 = Date.UTC(2026, 8, 23, 12, 0, 0);

test('memo token holds within a minute and flips at the boundary', () => {
  const fp = 123_456_789;
  assert.equal(memoToken(fp, T0), memoToken(fp, T0 + MINUTE - 1));
  assert.notEqual(memoToken(fp, T0 + MINUTE - 1), memoToken(fp, T0 + MINUTE));
  assert.notEqual(memoToken(fp, T0), memoToken(fp + 1, T0), 'a data change flips it too');
});

test('an idle dashboard still rebuilds time-windowed output once a minute', () => {
  const fp = 42; // no file is being written, so the data fingerprint never moves
  let builds = 0;
  // Stand-in for buildRecent & co.: the output depends on `now`, not only on the data.
  const build = (now: number) =>
    memoBuilder('test-window', [12, 'all'], memoToken(fp, now), () => {
      builds++;
      return now;
    });

  assert.equal(build(T0 + 5_000), T0 + 5_000);
  assert.equal(build(T0 + 55_000), T0 + 5_000, 'same minute: served from the memo');
  assert.equal(builds, 1);
  assert.equal(build(T0 + MINUTE + 1_000), T0 + MINUTE + 1_000, 'next minute: rebuilt');
  assert.equal(builds, 2);
});

const basis: MergeBasis = { fingerprint: 111, metaSig: 222 };

test('the merge is reused when nothing changed since the last one', () => {
  assert.equal(canReuseMerge(basis, { ...basis }, 0, 0), true);
});

test('the merge re-runs on a first scan, a re-parse, a removal, or a changed input', () => {
  assert.equal(canReuseMerge(null, basis, 0, 0), false, 'never merged: rows warmed from the store');
  assert.equal(canReuseMerge(basis, basis, 1, 0), false, 'a file was re-parsed or added');
  assert.equal(canReuseMerge(basis, basis, 0, 1), false, 'a file was removed');
  assert.equal(
    canReuseMerge(basis, { ...basis, fingerprint: 112 }, 0, 0),
    false,
    'fingerprint moved: e.g. the previous merge threw after the rows changed',
  );
  assert.equal(canReuseMerge(basis, { ...basis, metaSig: 223 }, 0, 0), false, 'session-meta sidecars changed');
});
