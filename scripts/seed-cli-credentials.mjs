#!/usr/bin/env node
// Runs at container startup (Dockerfile CMD) when WITH_CLAUDE_CLI=1, before the
// server starts. `claude -p` needs a writable config dir — the ~/.claude mount
// is read-only — so this seeds $CLAUDE_CONFIG_DIR from it. On macOS hosts the
// real `claudeAiOauth` block lives in the Keychain, not in .credentials.json
// (see readCredentials() in server/scan.ts), so `.credentials.json` alone often
// has no claudeAiOauth — this merges in `.dashboard-oauth-cache.json` (written
// by scripts/sync-macos-keychain.mjs) whenever that's the case, so the bundled
// CLI ends up logged in the same way the dashboard's own OAuth calls already are.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const claudeDir = process.env.CLAUDE_DIR || '/data/.claude';
const configDir = process.env.CLAUDE_CONFIG_DIR;

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  if (!configDir) return;
  await mkdir(configDir, { recursive: true });

  const destCredsPath = join(configDir, '.credentials.json');
  let creds = (await readJson(join(claudeDir, '.credentials.json'))) || {};

  if (!creds.claudeAiOauth?.accessToken) {
    const cache = await readJson(join(claudeDir, '.dashboard-oauth-cache.json'));
    if (cache?.claudeAiOauth?.accessToken) {
      creds = { ...creds, claudeAiOauth: cache.claudeAiOauth };
      if (cache.organizationUuid) creds.organizationUuid = cache.organizationUuid;
    }
  }
  if (creds.claudeAiOauth || creds.mcpOAuth) {
    await writeFile(destCredsPath, JSON.stringify(creds), 'utf8');
  }

  const settings = await readJson(join(claudeDir, 'settings.json'));
  if (settings) await writeFile(join(configDir, 'settings.json'), JSON.stringify(settings), 'utf8');

  const onboardingPath = join(configDir, '.claude.json');
  if (!(await readJson(onboardingPath))) {
    await writeFile(onboardingPath, JSON.stringify({ hasCompletedOnboarding: true }), 'utf8');
  }
}

main().catch((e) => {
  console.error('[seed-cli-credentials] skipped:', e.message);
});
