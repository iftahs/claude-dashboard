import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swrCache } from './swr-cache.ts';

const TTL = 3_000;
const MAX_STALE = 20_000;

const flush = () => new Promise<void>((r) => setImmediate(r));

/** A cache over a fake clock and builds the test lands or fails by index. */
function harness() {
  let t = Date.UTC(2026, 8, 23, 12, 0, 0);
  const builds: { resolve: (v: string) => void; reject: (e: unknown) => void }[] = [];
  const errors: unknown[] = [];
  const get = swrCache<string>({
    ttlMs: TTL,
    maxStaleMs: MAX_STALE,
    build: () => new Promise<string>((resolve, reject) => builds.push({ resolve, reject })),
    now: () => t,
    onError: (e) => errors.push(e),
  });
  return {
    get,
    errors,
    started: () => builds.length,
    advance: (ms: number) => void (t += ms),
    land: async (i: number, v: string) => {
      builds[i].resolve(v);
      await flush();
    },
    fail: async (i: number, message: string) => {
      builds[i].reject(new Error(message));
      await flush();
    },
  };
}

async function primed() {
  const h = harness();
  const first = h.get();
  await h.land(0, 'v1');
  assert.equal(await first, 'v1');
  return h;
}

async function isPending(p: Promise<unknown>): Promise<boolean> {
  let settled = false;
  p.then(() => (settled = true), () => (settled = true));
  await flush();
  return !settled;
}

test('the first call waits for the build, and concurrent first callers share it', async () => {
  const h = harness();
  const a = h.get();
  const b = h.get();
  assert.equal(await isPending(a), true);
  assert.equal(h.started(), 1);
  await h.land(0, 'v1');
  assert.deepEqual(await Promise.all([a, b]), ['v1', 'v1']);
});

test('inside the TTL the cached value is served without building', async () => {
  const h = await primed();
  h.advance(TTL - 1);
  assert.equal(await h.get(), 'v1');
  assert.equal(h.started(), 1);
});

test('past the TTL the previous value is served at once and exactly one rebuild starts', async () => {
  const h = await primed();
  h.advance(TTL);
  assert.deepEqual(await Promise.all([h.get(), h.get(), h.get()]), ['v1', 'v1', 'v1']);
  assert.equal(h.started(), 2);
  h.advance(1_000);
  assert.equal(await h.get(), 'v1', 'still the old value while the rebuild is in flight');
  assert.equal(h.started(), 2);

  await h.land(1, 'v2');
  assert.equal(await h.get(), 'v2');
  assert.equal(h.started(), 2);
});

test('the value is stamped when its build lands, so a build slower than the TTL is still a cache hit', async () => {
  const h = await primed();
  h.advance(TTL);
  await h.get();
  h.advance(TTL + 1_500);
  await h.land(1, 'v2');
  h.advance(TTL - 1);
  assert.equal(await h.get(), 'v2');
  assert.equal(h.started(), 2, 'no third build');
});

test('past the stale bound callers wait for the rebuild', async () => {
  const h = await primed();
  h.advance(MAX_STALE);
  const p = h.get();
  assert.equal(await isPending(p), true);
  assert.equal(h.started(), 2);
  await h.land(1, 'v2');
  assert.equal(await p, 'v2');
});

test('a rebuild that outlives the stale bound is joined, not restarted', async () => {
  const h = await primed();
  h.advance(TTL);
  assert.equal(await h.get(), 'v1');
  h.advance(MAX_STALE);
  const p = h.get();
  assert.equal(await isPending(p), true);
  assert.equal(h.started(), 2);
  await h.land(1, 'v2');
  assert.equal(await p, 'v2');
});

test('a failed background rebuild keeps the previous value and the next call retries', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  try {
    const h = await primed();
    h.advance(TTL);
    assert.equal(await h.get(), 'v1');
    await h.fail(1, 'boom');
    await flush();
    assert.equal(h.errors.length, 1);
    assert.deepEqual(unhandled, []);

    assert.equal(await h.get(), 'v1');
    assert.equal(h.started(), 3, 'the failure did not stick: a new rebuild started');
    await h.land(2, 'v3');
    assert.equal(await h.get(), 'v3');
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('a failed first build rejects to the caller and the next call retries', async () => {
  const h = harness();
  const p = h.get();
  const rejected = assert.rejects(p, /boom/);
  await h.fail(0, 'boom');
  await rejected;

  const q = h.get();
  assert.equal(h.started(), 2);
  await h.land(1, 'v1');
  assert.equal(await q, 'v1');
});

test('past the stale bound a failed rebuild rejects rather than serving older data, then recovers', async () => {
  const h = await primed();
  h.advance(MAX_STALE);
  const p = h.get();
  const rejected = assert.rejects(p, /boom/);
  await h.fail(1, 'boom');
  await rejected;

  const q = h.get();
  assert.equal(h.started(), 3);
  await h.land(2, 'v3');
  assert.equal(await q, 'v3');
});
