import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateCost, hasPrice } from './pricing.ts';

/** Per-1M rates recovered from estimateCost, one token class at a time. */
function rates(model: string) {
  const one = (k: 'inputTokens' | 'outputTokens' | 'cacheCreateTokens' | 'cacheReadTokens') =>
    Math.round(
      estimateCost(model, { inputTokens: 0, outputTokens: 0, cacheCreateTokens: 0, cacheReadTokens: 0, [k]: 1_000_000 }) *
        1000,
    ) / 1000;
  return { input: one('inputTokens'), output: one('outputTokens'), cacheWrite: one('cacheCreateTokens'), cacheRead: one('cacheReadTokens') };
}

test('specific Claude rows win over their generic family row', () => {
  assert.deepEqual(rates('claude-opus-5-5'), { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 });
  assert.deepEqual(rates('claude-opus-5'), { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 });
  assert.deepEqual(rates('claude-opus-4-8'), { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 });
  assert.deepEqual(rates('claude-opus-4-1'), { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 });
  assert.equal(rates('claude-fable-5-1').cacheRead, 0.25);
  assert.equal(rates('claude-fable-5').cacheRead, 1);
  assert.equal(rates('claude-mythos-5-1').cacheRead, 0.25);
  assert.equal(rates('claude-mythos-5').cacheRead, 1);
  assert.deepEqual(rates('claude-sonnet-5'), { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 });
  assert.equal(rates('claude-sonnet-4-5').input, 3);
});

test('gateway-prefixed ids resolve like the bare id', () => {
  assert.deepEqual(rates('vertex_ai/claude-opus-5-5'), rates('claude-opus-5-5'));
  assert.deepEqual(rates('anthropic.claude-opus-5-5'), rates('claude-opus-5-5'));
});

test('OpenAI rows use standard-tier list prices', () => {
  assert.deepEqual(rates('gpt-6-astra'), { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 });
  assert.deepEqual(rates('gpt-6-sol'), { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 });
  assert.deepEqual(rates('gpt-6-luna'), { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 });
  assert.deepEqual(rates('gpt-5.6-sol'), { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.4 });
  assert.deepEqual(rates('gpt-5.6-terra'), { input: 2, output: 12, cacheWrite: 2.5, cacheRead: 0.2 });
  assert.deepEqual(rates('gpt-5.5'), { input: 5, output: 30, cacheWrite: 0, cacheRead: 0.5 });
  assert.deepEqual(rates('gpt-5.3-codex'), { input: 1.75, output: 14, cacheWrite: 0, cacheRead: 0.175 });
  assert.equal(rates('gpt-something-new').input, 5, 'unknown gpt-* falls back to the generic row');
});

test('bundled Codex models are deliberately unpriced', () => {
  assert.equal(hasPrice('codex-auto-review'), false);
  assert.equal(hasPrice('gpt-reserve'), false);
  assert.equal(hasPrice('gpt-5.4-mini'), true);
  assert.equal(hasPrice('some-unknown-model'), true, 'DEFAULT counts as priced');
});
