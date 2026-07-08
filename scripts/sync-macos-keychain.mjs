#!/usr/bin/env node
// On macOS, Claude Code stores its real OAuth token in the Keychain (service
// "Claude Code-credentials") rather than in ~/.claude/.credentials.json. A
// Docker container can't reach the host Keychain, so this script — run before
// `docker compose up` via the `predocker:up` npm hook — copies just the
// `claudeAiOauth` block into a small cache file inside ~/.claude, which is
// already bind-mounted read-only into the container. No-op on non-macOS hosts
// or when there's nothing in the Keychain to sync (e.g. API-key-only setups).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

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
    return; // No matching Keychain item — nothing to sync.
  }

  if (!keychainJson?.claudeAiOauth?.accessToken) return;

  const cache = {
    claudeAiOauth: keychainJson.claudeAiOauth,
    organizationUuid: keychainJson.organizationUuid ?? null,
  };

  await writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`[sync-macos-keychain] synced Claude.ai OAuth token to ${cachePath}`);
}

main().catch((e) => {
  console.error('[sync-macos-keychain] skipped:', e.message);
});
