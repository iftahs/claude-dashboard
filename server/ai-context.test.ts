import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyResetIso } from './ai-context.ts';

const MONDAY = Date.UTC(2026, 8, 28, 1); // buildWeekly's nominal Mon 01:00 UTC

test('weeklyResetIso: the live seven_day.resets_at wins over the nominal Monday', () => {
  const usage = { seven_day: { utilization: 40, resets_at: '2026-09-27T22:00:00.412371+00:00' } };
  assert.equal(weeklyResetIso(usage, MONDAY), '2026-09-27T22:00:00.412Z');
});

test('weeklyResetIso: falls back to the nominal Monday when live has no usable reset', () => {
  const fallback = new Date(MONDAY).toISOString();
  assert.equal(weeklyResetIso(null, MONDAY), fallback); // live usage unavailable
  assert.equal(weeklyResetIso({}, MONDAY), fallback);
  assert.equal(weeklyResetIso({ seven_day: null }, MONDAY), fallback);
  assert.equal(weeklyResetIso({ seven_day: { resets_at: null } }, MONDAY), fallback); // no active window
  assert.equal(weeklyResetIso({ seven_day: { resets_at: 'soon' } }, MONDAY), fallback);
});
