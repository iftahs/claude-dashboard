#!/usr/bin/env node
// Manages the macOS LaunchAgent that keeps ~/.claude/.dashboard-oauth-cache.json
// fresh by re-running scripts/sync-macos-keychain.mjs every 15 minutes. The
// Docker container re-reads that file on every request, so a fresh cache means
// live usage never degrades to "OAuth token expired" while the container runs.
//
// Subcommands:
//   install    — write the plist and (re)load the agent, verbose output
//   uninstall  — unload the agent and delete the plist
//   status     — report agent + cache health (exit 1 when unhealthy)
//   ensure     — quiet, idempotent install; used by the `predocker:up` hook
//
// No-op (exit 0) on non-macOS hosts.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const LABEL = 'com.claude-dashboard.token-sync';
const PLIST_PATH = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const LOG_DIR = join(homedir(), 'Library', 'Logs', 'claude-dashboard');
const LOG_PATH = join(LOG_DIR, 'token-sync.log');
const SYNC_SCRIPT = fileURLToPath(new URL('./sync-macos-keychain.mjs', import.meta.url));
const INTERVAL_SECONDS = 900; // 15 min — tokens live hours, ample slack.

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// launchd runs jobs with a minimal PATH (/usr/bin:/bin:...), so `/usr/bin/env
// node` would never resolve an nvm/homebrew node — bake the absolute path of
// the node that ran the install instead. `status`/`ensure` detect and heal a
// baked path that later goes stale (node upgrade, repo move).
function renderPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(process.execPath)}</string>
    <string>${xmlEscape(SYNC_SCRIPT)}</string>
  </array>
  <key>StartInterval</key><integer>${INTERVAL_SECONDS}</integer>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${xmlEscape(LOG_PATH)}</string>
  <key>StandardErrorPath</key><string>${xmlEscape(LOG_PATH)}</string>
</dict>
</plist>
`;
}

async function launchctl(...args) {
  try {
    const { stdout } = await execFileAsync('launchctl', args);
    return { ok: true, stdout };
  } catch (e) {
    return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? e.message };
  }
}

const guiTarget = () => `gui/${process.getuid()}`;
const serviceTarget = () => `${guiTarget()}/${LABEL}`;

async function isLoaded() {
  return (await launchctl('print', serviceTarget())).ok;
}

async function install({ quiet = false } = {}) {
  await mkdir(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true });
  await mkdir(LOG_DIR, { recursive: true });

  // Reloading requires unload-then-load; ignore "not loaded" failures.
  await launchctl('bootout', serviceTarget());
  await writeFile(PLIST_PATH, renderPlist(), 'utf8');

  const bootstrap = await launchctl('bootstrap', guiTarget(), PLIST_PATH);
  if (!bootstrap.ok) {
    // Older macOS — fall back to the legacy subcommand.
    const load = await launchctl('load', '-w', PLIST_PATH);
    if (!load.ok) {
      console.error(`[token-sync-agent] failed to load agent: ${bootstrap.stderr}`.trim());
      process.exitCode = 1;
      return;
    }
  }

  if (quiet) {
    console.log(`[token-sync-agent] installed LaunchAgent ${LABEL} (Keychain → OAuth cache every 15 min; opt out: npm run token-sync:uninstall)`);
  } else {
    console.log(`[token-sync-agent] installed ${PLIST_PATH}`);
    console.log(`[token-sync-agent] syncs the Keychain OAuth token every ${INTERVAL_SECONDS / 60} min (and at login)`);
    console.log(`[token-sync-agent] log: ${LOG_PATH}`);
    console.log('[token-sync-agent] uninstall any time: npm run token-sync:uninstall');
  }
}

async function uninstall() {
  const bootout = await launchctl('bootout', serviceTarget());
  if (!bootout.ok) await launchctl('unload', PLIST_PATH);
  await rm(PLIST_PATH, { force: true });
  console.log(`[token-sync-agent] removed ${LABEL}`);
  console.log(`[token-sync-agent] kept the log (${LOG_PATH}) and the OAuth cache file — a running container may still need the cache.`);
}

/** Parse the two ProgramArguments (node bin, script path) out of an installed plist. */
function parseProgramArguments(plistXml) {
  const arrayMatch = /<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plistXml);
  if (!arrayMatch) return [];
  return [...arrayMatch[1].matchAll(/<string>([\s\S]*?)<\/string>/g)].map((m) =>
    m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
  );
}

async function readCacheInfo() {
  // Same resolution the sync script uses for the target dir, minus env
  // overrides rarely relevant here: keep it simple and honor the common ones.
  const claudeDir = process.env.CLAUDE_DIR_HOST || process.env.CLAUDE_DIR || join(homedir(), '.claude');
  const cachePath = join(claudeDir, '.dashboard-oauth-cache.json');
  try {
    const [content, info] = await Promise.all([readFile(cachePath, 'utf8'), stat(cachePath)]);
    const expiresAt = JSON.parse(content)?.claudeAiOauth?.expiresAt ?? null;
    return { cachePath, expiresAt, mtime: info.mtime };
  } catch {
    return { cachePath, expiresAt: null, mtime: null };
  }
}

async function status() {
  let healthy = true;
  const problem = (msg) => {
    healthy = false;
    console.log(`  ✗ ${msg}`);
  };
  const ok = (msg) => console.log(`  ✓ ${msg}`);

  console.log(`[token-sync-agent] status of ${LABEL}`);

  if (!existsSync(PLIST_PATH)) {
    problem(`plist not installed (${PLIST_PATH}) — run: npm run token-sync:install`);
  } else {
    ok(`plist installed: ${PLIST_PATH}`);
    const [nodeBin, scriptPath] = parseProgramArguments(await readFile(PLIST_PATH, 'utf8'));
    if (nodeBin && !existsSync(nodeBin)) {
      problem(`baked node binary missing (${nodeBin}) — node was upgraded/removed; re-run: npm run token-sync:install`);
    }
    if (scriptPath && !existsSync(scriptPath)) {
      problem(`sync script missing (${scriptPath}) — repo moved; re-run: npm run token-sync:install`);
    }
  }

  const print = await launchctl('print', serviceTarget());
  if (!print.ok) {
    problem('agent not loaded in launchd — run: npm run token-sync:install');
  } else {
    const state = /state = (.+)/.exec(print.stdout)?.[1]?.trim();
    const lastExit = /last exit code = (.+)/.exec(print.stdout)?.[1]?.trim();
    ok(`agent loaded${state ? ` (state: ${state})` : ''}${lastExit !== undefined ? `, last exit code: ${lastExit}` : ''}`);
    if (lastExit && lastExit !== '0' && lastExit !== '(never exited)') {
      problem(`last run failed (exit ${lastExit}) — check the log below`);
    }
  }

  const { cachePath, expiresAt, mtime } = await readCacheInfo();
  if (!expiresAt) {
    problem(`OAuth cache missing or unreadable (${cachePath}) — run: npm run token-sync`);
  } else {
    const deltaH = (expiresAt - Date.now()) / 3_600_000;
    const when = `${Math.abs(deltaH).toFixed(1)}h`;
    if (deltaH > 0) ok(`cached token expires in ${when} (${cachePath}, synced ${mtime?.toISOString() ?? '?'})`);
    else problem(`cached token EXPIRED ${when} ago — run \`claude\` once to refresh the Keychain, then npm run token-sync`);
  }

  try {
    const lines = (await readFile(LOG_PATH, 'utf8')).trimEnd().split('\n');
    console.log(`  · last log lines (${LOG_PATH}):`);
    for (const line of lines.slice(-5)) console.log(`    ${line}`);
  } catch {
    console.log(`  · no log yet (${LOG_PATH})`);
  }

  if (!healthy) process.exitCode = 1;
}

/** Quiet + idempotent: (re)install only when missing, outdated, or unloaded. */
async function ensure() {
  if (existsSync(PLIST_PATH)) {
    const current = await readFile(PLIST_PATH, 'utf8');
    if (current === renderPlist() && (await isLoaded())) return;
  }
  await install({ quiet: true });
}

async function main() {
  const command = process.argv[2];
  if (process.platform !== 'darwin') {
    if (command !== 'ensure') {
      console.log('[token-sync-agent] macOS only — on Linux/Windows Claude Code refreshes ~/.claude/.credentials.json itself, so no agent is needed.');
    }
    return;
  }
  switch (command) {
    case 'install': return install();
    case 'uninstall': return uninstall();
    case 'status': return status();
    case 'ensure': return ensure();
    default:
      console.error('Usage: token-sync-agent.mjs <install|uninstall|status|ensure>');
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`[token-sync-agent] failed: ${e.message}`);
  process.exitCode = 1;
});
