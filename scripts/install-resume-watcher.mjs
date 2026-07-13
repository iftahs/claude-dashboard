#!/usr/bin/env node
/**
 * install-resume-watcher.mjs — register the resume watcher as a background
 * auto-start, so no terminal has to stay open.
 *
 *   node scripts/install-resume-watcher.mjs [--url http://localhost:8787]
 *   node scripts/install-resume-watcher.mjs --uninstall
 *   (or: npm run resume-watcher:install / resume-watcher:uninstall)
 *
 * Per OS (no admin rights needed on any of them):
 *   Windows — writes a silent .vbs launcher into the user's Startup folder
 *             (runs hidden at every logon) and starts it immediately.
 *   macOS   — a launchd user agent in ~/Library/LaunchAgents (RunAtLoad+KeepAlive).
 *   Linux   — a systemd user unit, `systemctl --user enable --now`.
 *
 * Output of the watcher goes to ~/.claude-resume-watcher.log on every OS.
 */

import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const UNINSTALL = process.argv.includes('--uninstall');
const urlIdx = process.argv.indexOf('--url');
const URL = (urlIdx !== -1 && process.argv[urlIdx + 1]) || 'http://localhost:8787';

const NODE = process.execPath; // absolute node path — logon PATH can differ from the shell's
const WATCHER = join(dirname(fileURLToPath(import.meta.url)), 'resume-watcher.mjs');
const LOG = join(os.homedir(), '.claude-resume-watcher.log');
const NAME = 'claude-resume-watcher';

function log(msg) {
  console.log(`[install-resume-watcher] ${msg}`);
}

/** Stop any watcher process currently running (avoids duplicates on reinstall). */
async function killRunningWatchers() {
  try {
    if (process.platform === 'win32') {
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*resume-watcher.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
      ]);
    } else {
      await execFileAsync('pkill', ['-f', 'resume-watcher.mjs']).catch(() => {});
    }
  } catch {
    /* nothing running — fine */
  }
}

// ── Windows: silent .vbs in the Startup folder ──────────────────────────────

function windowsPaths() {
  const startup = join(
    process.env.APPDATA ?? join(os.homedir(), 'AppData', 'Roaming'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup',
  );
  return { vbs: join(startup, `${NAME}.vbs`) };
}

async function installWindows() {
  const { vbs } = windowsPaths();
  // cmd /c ""node" "watcher" --url ... >> "log" 2>&1" — run hidden (0) by wscript.
  const runCmd = `cmd /c ""${NODE}" "${WATCHER}" --url ${URL} >> "${LOG}" 2>&1"`;
  const content = `CreateObject("WScript.Shell").Run "${runCmd.replace(/"/g, '""')}", 0, False\r\n`;
  writeFileSync(vbs, content);
  log(`installed: ${vbs}`);
  log('runs hidden at every logon; starting it now…');
  await killRunningWatchers();
  spawn('wscript.exe', [vbs], { detached: true, stdio: 'ignore' }).unref();
  // Verify it actually came up (a silently-failed spawn is worse than an error) —
  // retry once via PowerShell Start-Process, which survives odd shell contexts.
  await new Promise((r) => setTimeout(r, 4000));
  if (!(await watcherRunning())) {
    log('first start attempt did not come up — retrying…');
    await execFileAsync('powershell.exe', [
      '-NoProfile', '-Command', `Start-Process wscript.exe -ArgumentList '"${vbs}"'`,
    ]).catch(() => {});
    await new Promise((r) => setTimeout(r, 4000));
  }
  log((await watcherRunning())
    ? 'watcher is running (hidden).'
    : `watcher did not start — check ${LOG}, or run it once in a terminal to see the error.`);
}

async function watcherRunning() {
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile', '-Command',
      "(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*resume-watcher.mjs*' } | Measure-Object).Count",
    ]);
    return Number(stdout.trim()) > 0;
  } catch {
    return false;
  }
}

async function uninstallWindows() {
  const { vbs } = windowsPaths();
  if (existsSync(vbs)) {
    rmSync(vbs);
    log(`removed: ${vbs}`);
  } else {
    log('no startup entry found');
  }
  await killRunningWatchers();
  log('stopped any running watcher');
}

// ── macOS: launchd user agent ────────────────────────────────────────────────

function macPlistPath() {
  return join(os.homedir(), 'Library', 'LaunchAgents', `dev.iftah.${NAME}.plist`);
}

async function installMac() {
  const plist = macPlistPath();
  mkdirSync(dirname(plist), { recursive: true });
  writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>dev.iftah.${NAME}</string>
  <key>ProgramArguments</key><array>
    <string>${NODE}</string>
    <string>${WATCHER}</string>
    <string>--url</string>
    <string>${URL}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict></plist>
`,
  );
  await execFileAsync('launchctl', ['unload', plist]).catch(() => {});
  await execFileAsync('launchctl', ['load', '-w', plist]);
  log(`installed + started launchd agent: ${plist}`);
}

async function uninstallMac() {
  const plist = macPlistPath();
  await execFileAsync('launchctl', ['unload', plist]).catch(() => {});
  if (existsSync(plist)) rmSync(plist);
  await killRunningWatchers();
  log('launchd agent removed and watcher stopped');
}

// ── Linux: systemd user unit ─────────────────────────────────────────────────

function linuxUnitPath() {
  return join(os.homedir(), '.config', 'systemd', 'user', `${NAME}.service`);
}

async function installLinux() {
  const unit = linuxUnitPath();
  mkdirSync(dirname(unit), { recursive: true });
  writeFileSync(
    unit,
    `[Unit]
Description=Claude Dashboard resume watcher

[Service]
ExecStart=${NODE} ${WATCHER} --url ${URL}
Restart=on-failure
StandardOutput=append:${LOG}
StandardError=append:${LOG}

[Install]
WantedBy=default.target
`,
  );
  await execFileAsync('systemctl', ['--user', 'daemon-reload']);
  await execFileAsync('systemctl', ['--user', 'enable', '--now', `${NAME}.service`]);
  log(`installed + started systemd user unit: ${unit}`);
}

async function uninstallLinux() {
  await execFileAsync('systemctl', ['--user', 'disable', '--now', `${NAME}.service`]).catch(() => {});
  const unit = linuxUnitPath();
  if (existsSync(unit)) rmSync(unit);
  await execFileAsync('systemctl', ['--user', 'daemon-reload']).catch(() => {});
  log('systemd unit removed and watcher stopped');
}

// ── Main ─────────────────────────────────────────────────────────────────────

try {
  if (process.platform === 'win32') {
    await (UNINSTALL ? uninstallWindows() : installWindows());
  } else if (process.platform === 'darwin') {
    await (UNINSTALL ? uninstallMac() : installMac());
  } else {
    await (UNINSTALL ? uninstallLinux() : installLinux());
  }
  if (!UNINSTALL) {
    log(`dashboard url: ${URL}`);
    log(`watcher log:   ${LOG}`);
    log('done — the Auto-Resume page should show "Host watcher connected" within ~30s.');
  }
} catch (e) {
  console.error(`[install-resume-watcher] failed: ${e.message}`);
  process.exit(1);
}
