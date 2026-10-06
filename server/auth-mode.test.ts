import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { authModeOf, readCredentials } from './scan.ts';

const TMP = mkdtempSync(join(tmpdir(), 'dash-auth-'));
process.env.CLAUDE_DIR = TMP;
after(() => rmSync(TMP, { recursive: true, force: true }));

const RELOGIN = { accessToken: '', refreshToken: '', expiresAt: null, subscriptionType: 'max', rateLimitTier: 'default_claude_max_20x' };

test('a blank access token on a block that names a plan is still a subscription', () => {
  assert.equal(authModeOf(RELOGIN), 'subscription');
  assert.equal(authModeOf({ accessToken: '   ', subscriptionType: 'pro' }), 'subscription');
});

test('a refresh token alone is a subscription', () => {
  assert.equal(authModeOf({ accessToken: '', refreshToken: 'synthetic-refresh', expiresAt: null }), 'subscription');
});

test('a real access token is a subscription', () => {
  assert.equal(authModeOf({ accessToken: 'synthetic-access' }), 'subscription');
});

test('no block is pay-as-you-go', () => {
  assert.equal(authModeOf(undefined), 'api');
  assert.equal(authModeOf(null), 'api');
});

test('a block with nothing useful is pay-as-you-go', () => {
  assert.equal(authModeOf({}), 'api');
  assert.equal(authModeOf({ accessToken: '', refreshToken: '', subscriptionType: '', expiresAt: null }), 'api');
  assert.equal(authModeOf({ subscriptionType: null, scopes: ['user:inference'] }), 'api');
  assert.equal(authModeOf('max'), 'api');
});

// On macOS readCredentials() falls through to the real Keychain, which a test must not read.
const fileOnly = { skip: platform() === 'darwin' };

function write(name: string, json: unknown): void {
  writeFileSync(join(TMP, name), JSON.stringify(json));
}

test('readCredentials keeps a token-less block, so its plan survives a re-login', fileOnly, async () => {
  write('.credentials.json', { claudeAiOauth: RELOGIN });
  const oauth = (await readCredentials())?.claudeAiOauth;
  assert.equal(oauth?.subscriptionType, 'max');
  assert.equal(authModeOf(oauth), 'subscription');
});

test('readCredentials falls back to a token-less Keychain cache when the file has no block', fileOnly, async () => {
  write('.credentials.json', { mcpOAuth: {} });
  write('.dashboard-oauth-cache.json', { claudeAiOauth: RELOGIN });
  assert.equal(authModeOf((await readCredentials())?.claudeAiOauth), 'subscription');
});

test('a token in either source still wins over a token-less block', fileOnly, async () => {
  write('.credentials.json', { claudeAiOauth: RELOGIN });
  write('.dashboard-oauth-cache.json', { claudeAiOauth: { accessToken: 'synthetic-cached', expiresAt: 1 } });
  assert.equal((await readCredentials())?.claudeAiOauth?.accessToken, 'synthetic-cached');
});

test('no Claude.ai block anywhere stays pay-as-you-go', fileOnly, async () => {
  write('.credentials.json', { mcpOAuth: {} });
  write('.dashboard-oauth-cache.json', {});
  assert.equal(authModeOf((await readCredentials())?.claudeAiOauth), 'api');
});
