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
