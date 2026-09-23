import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeSources } from './sources.ts';

// Synthetic events only.
const dirs = { claudeDir: '/data/.claude', codexDir: '/data/.codex', coworkDir: '/data/cowork' };

test('summarizeSources counts events and the newest timestamp per surface', () => {
  const s = summarizeSources(
    [
      { source: 'code', ts: 100 },
      { source: 'code', ts: 300 },
      { source: 'code', ts: 200 },
      { source: 'codex', ts: 50 },
      { source: 'cowork', ts: 400 },
      { source: 'cowork', ts: 10 },
    ],
    dirs,
  );
  assert.deepEqual(s.code, { events: 3, lastTs: 300 });
  assert.deepEqual(s.cowork, { available: true, events: 2, lastTs: 400 });
  assert.deepEqual(s.codex, { available: true, events: 1, lastTs: 50 });
});

test('summarizeSources reports an absent surface as unavailable with zero counts', () => {
  const s = summarizeSources([{ source: 'codex', ts: 7 }], dirs);
  assert.deepEqual(s.code, { events: 0, lastTs: 0 });
  assert.deepEqual(s.cowork, { available: false, events: 0, lastTs: 0 });
  assert.deepEqual(s.codex, { available: true, events: 1, lastTs: 7 });
});

test('summarizeSources passes the data dirs through, and an empty cowork root becomes null', () => {
  const s = summarizeSources([], { ...dirs, coworkDir: '' });
  assert.equal(s.claudeDir, '/data/.claude');
  assert.equal(s.codexDir, '/data/.codex');
  assert.equal(s.coworkDir, null);
  assert.equal(summarizeSources([], dirs).coworkDir, '/data/cowork');
});

test('summarizeSources keeps the original payload keys for older clients', () => {
  const s = summarizeSources([], dirs);
  assert.deepEqual(Object.keys(s.code).sort(), ['events', 'lastTs']);
  assert.deepEqual(Object.keys(s.cowork).sort(), ['available', 'events', 'lastTs']);
  assert.deepEqual(Object.keys(s.codex).sort(), ['available', 'events', 'lastTs']);
});
