#!/usr/bin/env node
// On macOS, Claude Code stores its real OAuth token in the Keychain (service
// "Claude Code-credentials") rather than in ~/.claude/.credentials.json. A
// Docker container can't reach the host Keychain, so this script copies just
// the `claudeAiOauth` block into a small cache file inside ~/.claude, which is
// already bind-mounted read-only into the container. It runs before
// `docker compose up` via the `predocker:up` npm hook, and every 15 minutes
// via the token-sync LaunchAgent (scripts/token-sync-agent.mjs) so the cached
// token never goes stale while the container runs. No-op on non-macOS hosts
// or when there's nothing in the Keychain to sync (e.g. API-key-only setups).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);
const verbose = process.argv.includes('--verbose');

// Timestamped lines: launchd appends stdout/stderr to a plain log file with no
// timestamps of its own.
const log = (msg) => console.log(`${new Date().toISOString()} [sync-macos-keychain] ${msg}`);
const logError = (msg) => console.error(`${new Date().toISOString()} [sync-macos-keychain] ${msg}`);

// `.env` (repo root) isn't auto-loaded outside of `docker compose` — read
// CLAUDE_DIR_HOST from it directly so this matches whatever the container mounts.
async function readDotEnvVar(name) {
  try {
    const content = await readFile(new URL('../.env', import.meta.url), 'utf8');
    return new RegExp(`^${name}=(.*)$`, 'm').exec(content)?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

const MAX_RECORDED_TOKENS = 8; // a few distinct logins is plenty; bounds growth

/**
 * Accumulate distinct OAuth tokens into `~/.claude/.dashboard-accounts.json` so
 * the dashboard can show every logged-in account's live limits. Claude Code
 * shares a single Keychain slot, so each account switch is our one chance to
 * snapshot it. The token blob carries NO stable account id (no org/account/email
 * — those only come from the OAuth profile endpoint), so this stays a plain
 * network-free ring of tokens deduped by accessToken; the backend resolves
 * identity and dedups accounts via the profile it fetches anyway. Atomic write,
 * 0600 — it holds access tokens.
 */
async function recordToken(claudeDir, keychainJson) {
  const oauth = keychainJson.claudeAiOauth;
  const accountsPath = join(claudeDir, '.dashboard-accounts.json');

  let tokens = [];
  try {
    const parsed = JSON.parse(await readFile(accountsPath, 'utf8'));
    if (Array.isArray(parsed?.tokens)) tokens = parsed.tokens;
  } catch {
    // Missing or corrupt file — start fresh.
  }

  // Already have this exact token (unchanged since the last tick) — nothing to do.
  if (tokens.some((t) => t?.claudeAiOauth?.accessToken === oauth.accessToken)) {
    if (verbose) log('token already recorded');
    return;
  }

  tokens.unshift({ claudeAiOauth: oauth, capturedAt: Date.now() });
  tokens = tokens.slice(0, MAX_RECORDED_TOKENS);

  const tmpPath = `${accountsPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify({ tokens }, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tmpPath, accountsPath);
  log(`recorded account token (${tokens.length} known) in ${accountsPath}`);
}

async function main() {
  if (process.platform !== 'darwin') return;

  const claudeDir =
    process.env.CLAUDE_DIR_HOST ||
    process.env.CLAUDE_DIR ||
    (await readDotEnvVar('CLAUDE_DIR_HOST')) ||
    join(homedir(), '.claude');
  const cachePath = join(claudeDir, '.dashboard-oauth-cache.json');

  let keychainJson;
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password', '-s', 'Claude Code-credentials', '-w',
    ]);
    keychainJson = JSON.parse(stdout);
  } catch {
    if (verbose) log('no Keychain item — nothing to sync');
    return; // No matching Keychain item — nothing to sync.
  }

  if (!keychainJson?.claudeAiOauth?.accessToken) {
    if (verbose) log('Keychain item has no claudeAiOauth.accessToken — nothing to sync');
    return;
  }

  // Record this token into the ring that powers the multi-account live view.
  // Done BEFORE the single-cache regression check below: the shared Keychain slot
  // only ever holds the currently-active account, so each account switch is our
  // one chance to capture it — even when its token expires sooner than what the
  // single cache already holds (which would short-circuit below).
  await recordToken(claudeDir, keychainJson);

  // Never regress the cache: skip when it already holds this token, or one
  // that outlives what the Keychain has (the container re-reads the file on
  // every request, so a needless write buys nothing).
  try {
    const existing = JSON.parse(await readFile(cachePath, 'utf8'))?.claudeAiOauth;
    const fresh = keychainJson.claudeAiOauth;
    if (
      existing?.accessToken &&
      (existing.accessToken === fresh.accessToken ||
        (existing.expiresAt ?? 0) >= (fresh.expiresAt ?? 0))
    ) {
      if (verbose) log(`cache already up to date (expires ${new Date(existing.expiresAt ?? 0).toISOString()})`);
      return;
    }
  } catch {
    // Missing or corrupt cache file — write a fresh one.
  }

  const cache = {
    claudeAiOauth: keychainJson.claudeAiOauth,
    organizationUuid: keychainJson.organizationUuid ?? null,
  };

  // Atomic replace: the container reads this file per request, so it must
  // never observe a half-written JSON. 0600 — it holds tokens.
  const tmpPath = `${cachePath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(cache, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tmpPath, cachePath);
  const expiresAt = keychainJson.claudeAiOauth.expiresAt;
  log(`synced Claude.ai OAuth token to ${cachePath}${expiresAt ? ` (expires ${new Date(expiresAt).toISOString()})` : ''}`);
}

main().catch((e) => {
  logError(`failed: ${e.message}`);
  process.exitCode = 1;
});
