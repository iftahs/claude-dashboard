import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySubscription } from './subscription.ts';

const none = { subscriptionType: null, rateLimitTier: null };
const profile = (account: object, organization: object = {}) => ({ account: { uuid: 'a', ...account }, organization });

test('Max tiers keep their existing values', () => {
  assert.equal(classifySubscription(profile({ has_claude_max: true }, { rate_limit_tier: 'default_claude_max_20x' }), none).subscriptionType, 'max_20x');
  assert.equal(classifySubscription(profile({ has_claude_max: true }, { rate_limit_tier: 'default_claude_max_5x' }), none).subscriptionType, 'max_5x');
  assert.equal(classifySubscription(profile({ has_claude_max: true }), none).subscriptionType, 'max');
  assert.equal(classifySubscription(profile({ has_claude_pro: true }), none).subscriptionType, 'pro');
  assert.equal(classifySubscription(profile({}, { organization_type: 'claude_team' }), none).subscriptionType, 'team');
  assert.equal(classifySubscription(profile({}), none).subscriptionType, 'free');
});

test('an ultra tier on the live profile is ultra, with or without the max flag', () => {
  for (const account of [{ has_claude_max: true }, {}]) {
    const sub = classifySubscription(profile(account, { rate_limit_tier: 'default_claude_ultra' }), { subscriptionType: 'max', rateLimitTier: null });
    assert.equal(sub.subscriptionType, 'ultra');
    assert.equal(sub.rateLimitTier, 'default_claude_ultra');
  }
});

test('without a profile the credential blob decides; with one, its plan wins over a stale blob', () => {
  assert.equal(classifySubscription(null, { subscriptionType: 'ultra', rateLimitTier: null }).subscriptionType, 'ultra');
  assert.equal(classifySubscription(null, { subscriptionType: 'max', rateLimitTier: 'default_claude_ultra' }).subscriptionType, 'ultra');
  assert.equal(classifySubscription(null, { subscriptionType: 'max', rateLimitTier: 'default_claude_max_5x' }).subscriptionType, 'max');
  assert.equal(
    classifySubscription(profile({ has_claude_pro: true }), { subscriptionType: 'ultra', rateLimitTier: 'default_claude_ultra' }).subscriptionType,
    'pro',
  );
});
