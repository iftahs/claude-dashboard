#!/usr/bin/env node
/**
 * resume-watcher.mjs — host-side executor for the dashboard's auto-resume feature.
 *
 * The dashboard backend (often in Docker, which can't spawn `claude` on the
 * host) schedules ResumeJobs when a usage limit is hit. This script runs on
 * the HOST, polls the dashboard for pending jobs, and when one is due spawns
 * `claude -p --resume <sessionId>` with the resume prompt on stdin — appending
 * to the interrupted session's own JSONL, headless.
 *
 * Run:   npm run resume-watcher
 *        node scripts/resume-watcher.mjs --url http://localhost:8787
 * Args:  --url <origin>  dashboard origin (same syntax in cmd/PowerShell/bash;
 *                        wins over DASHBOARD_URL)
 * Env:   DASHBOARD_URL   dashboard origin (default http://localhost:8787; dev UI is 5180)
 *        POLL_MS         poll interval, ms (default 30000)
 *        WATCHER_ID      identity reported to the backend (default hostname-pid)
 *
 * Zero dependencies; Node >= 20 (global fetch). Ctrl+C exits WITHOUT killing a
 * running resume — the spawned claude finishes the work on its own.
 */

import { spawn } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

// --url flag beats DASHBOARD_URL — one syntax across cmd/PowerShell/bash.
const urlFlagIdx = process.argv.indexOf('--url');
const urlFlag = urlFlagIdx !== -1 ? process.argv[urlFlagIdx + 1] : undefined;
const BASE = (urlFlag || process.env.DASHBOARD_URL || 'http://localhost:8787').replace(/\/+$/, '');
const POLL_MS = Number(process.env.POLL_MS || 30_000);
const WATCHER_ID = process.env.WATCHER_ID || `${os.hostname()}-${process.pid}`;
const OUTPUT_CAP = 64 * 1024;

const inFlight = new Set(); // job ids currently executing locally
let lastConnState = null; // 'up' | 'down' — log only on transitions

function log(...args) {
  console.log(`[resume-watcher] ${new Date().toISOString()}`, ...args);
}

async function api(path, opts) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/** Windows `claude` is a .cmd shim → route through cmd /c (mirrors server/ai.ts). */
function cliInvocation(args) {
  if (process.platform === 'win32') {
    return { file: process.env.ComSpec || 'cmd.exe', args: ['/c', 'claude', ...args] };
  }
  return { file: 'claude', args };
}

function permissionArgs(permission) {
  // 'inherit' = no flag → the session's own mode. Everything else maps 1:1 to
  // the CLI's --permission-mode values (plan / acceptEdits / auto / bypassPermissions).
  return !permission || permission === 'inherit' ? [] : ['--permission-mode', permission];
}

function runResume(job, useCwd) {
  return new Promise((resolve) => {
    const cliArgs = ['-p', '--resume', job.sessionId, ...permissionArgs(job.permission)];
    // Tool grants travel via a temp --settings JSON file, NEVER as command-line
    // text: `cmd /c` re-parses the flattened line, so a rule containing `|` or `"`
    // (e.g. Bash(grep -r "a\|b" …)) breaks out and cmd executes the fragment.
    let grantsFile = null;
    if (Array.isArray(job.allowedTools) && job.allowedTools.length) {
      try {
        grantsFile = join(os.tmpdir(), `claude-resume-grants-${process.pid}-${Date.now()}.json`);
        writeFileSync(grantsFile, JSON.stringify({ permissions: { allow: job.allowedTools } }));
        cliArgs.push('--settings', grantsFile);
      } catch {
        grantsFile = null; // grants are an enhancement — resume without them
      }
    }
    const cleanup = () => {
      if (grantsFile) {
        try { unlinkSync(grantsFile); } catch { /* already gone */ }
        grantsFile = null;
      }
    };
    const { file, args } = cliInvocation(cliArgs);
    const opts = { windowsHide: true };
    if (useCwd && job.projectPath) opts.cwd = job.projectPath;
    let child;
    try {
      child = spawn(file, args, opts);
    } catch (e) {
      cleanup();
      resolve({ ok: false, message: `spawn failed: ${e.message}` });
      return;
    }
    let out = '';
    const cap = (chunk) => {
      if (out.length < OUTPUT_CAP) out += chunk.toString('utf8');
    };
    child.stdout?.on('data', cap);
    child.stderr?.on('data', cap);
    child.on('error', (e) => { cleanup(); resolve({ ok: false, message: `spawn error: ${e.message}` }); });
    child.on('close', (code) => { cleanup(); resolve({ ok: code === 0, exitCode: code ?? -1, message: out.slice(-4000) }); });
    // Prompt via stdin — never an argv element, so no cmd.exe quoting hazards.
    child.stdin?.end(job.prompt);
  });
}

async function executeJob(job) {
  inFlight.add(job.id);
  try {
    const claim = await api(`/api/auto-resume/jobs/${encodeURIComponent(job.id)}/claim`, {
      method: 'POST',
      body: JSON.stringify({ claimedBy: WATCHER_ID }),
    });
    if (claim.status !== 200) {
      log(`claim ${job.id} → ${claim.status} (${claim.body?.error ?? 'skipped'})`);
      return;
    }
    log(`resuming session ${job.sessionId} in ${job.projectPath || '(no cwd)'} [${job.permission}]`);

    const hasCwd = job.projectPath && existsSync(job.projectPath);
    if (job.projectPath && !hasCwd) log(`project path missing on host, spawning without cwd: ${job.projectPath}`);
    let result = await runResume(job, hasCwd);
    if (!result.ok && hasCwd && /ENOENT|spawn/i.test(result.message || '')) {
      log('retrying without cwd');
      result = await runResume(job, false);
    }

    log(`session ${job.sessionId} finished: ${result.ok ? 'ok' : 'FAILED'} (exit ${result.exitCode ?? '?'})`);
    await api(`/api/auto-resume/jobs/${encodeURIComponent(job.id)}/complete`, {
      method: 'POST',
      body: JSON.stringify(result),
    });
  } catch (e) {
    log(`job ${job.id} error: ${e.message}`);
    try {
      await api(`/api/auto-resume/jobs/${encodeURIComponent(job.id)}/complete`, {
        method: 'POST',
        body: JSON.stringify({ ok: false, message: `watcher error: ${e.message}` }),
      });
    } catch {
      /* backend unreachable — job stays claimed; backend re-derives if needed */
    }
  } finally {
    inFlight.delete(job.id);
  }
}

async function tick() {
  let pending;
  try {
    pending = await api(`/api/auto-resume/pending?watcherId=${encodeURIComponent(WATCHER_ID)}`);
  } catch (e) {
    if (lastConnState !== 'down') {
      log(`dashboard unreachable at ${BASE} (${e.message}) — will keep retrying`);
      lastConnState = 'down';
    }
    return;
  }
  if (lastConnState !== 'up') {
    log(`connected to ${BASE}`);
    lastConnState = 'up';
  }
  const { jobs = [], serverNow = Date.now() } = pending.body?.data ?? {};
  // Sequential on purpose: several sessions can be waiting on the same reset,
  // and N parallel resumes would race each other into the fresh window.
  for (const job of jobs) {
    // Compare against serverNow, not the local clock — kills clock skew.
    if (job.resumeAt <= serverNow && !inFlight.has(job.id)) {
      await executeJob(job);
    }
  }
}

log(`watcher ${WATCHER_ID} polling ${BASE} every ${POLL_MS / 1000}s`);
let busy = false;
async function safeTick() {
  if (busy) return; // a long resume is still running — skip overlapping ticks
  busy = true;
  try {
    await tick();
  } finally {
    busy = false;
  }
}
await safeTick();
const timer = setInterval(() => void safeTick(), POLL_MS);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    clearInterval(timer);
    if (inFlight.size) {
      log(`exiting — ${inFlight.size} resume still running; leaving it to finish on its own`);
    } else {
      log('exiting');
    }
    process.exit(0);
  });
}
