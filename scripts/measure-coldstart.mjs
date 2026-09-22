#!/usr/bin/env node
/**
 * measure-coldstart.mjs — time a real backend cold start.
 *
 * Spawns `tsx server/index.ts` on a scratch port and measures wall-clock from
 * process spawn until each probe endpoint first answers. That is the number the
 * user actually experiences on first load, unlike an in-process scan benchmark
 * which misses process boot and cache priming.
 *
 *   node scripts/measure-coldstart.mjs --runs 2 --claude-dir C:/tmp/claude-freeze/.claude \
 *                                      --cowork-dir C:/tmp/claude-freeze/cowork
 *
 * --keep-cache  leave DASHBOARD_CACHE_DIR intact between runs (measures the warm-cache
 *               path). Default wipes it so every run is a true cold build.
 */
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : dflt;
};
const has = (name) => process.argv.includes(name);

const RUNS = Number(arg('--runs', '2'));
const PORT = Number(arg('--port', '8801'));
const CLAUDE_DIR = arg('--claude-dir', '');
const COWORK_DIR = arg('--cowork-dir', '');
const CACHE_DIR = arg('--cache-dir', '');
const KEEP = has('--keep-cache');

const PROBES = [
  '/api/health',
  '/api/usage/recent?hours=12',
  '/api/sessions',
  '/api/insights/errors?days=30',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, startedAt, deadlineMs = 180_000) {
  while (performance.now() - startedAt < deadlineMs) {
    try {
      // Per-attempt timeout must exceed the slowest cold endpoint, or a slow
      // response is aborted and retried forever instead of being measured.
      const res = await fetch(url, { signal: AbortSignal.timeout(deadlineMs) });
      if (res.ok) { await res.arrayBuffer(); return performance.now() - startedAt; }
    } catch { /* not up yet */ }
    await sleep(25);
  }
  return NaN;
}

/** Windows: child.kill() only kills the shell, leaving the node grandchild bound to the port. */
function killTree(child) {
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch { /* fall through */ }
  }
  try { child.kill('SIGKILL'); } catch { /* already gone */ }
}

const results = [];

for (let run = 1; run <= RUNS; run++) {
  if (CACHE_DIR && !KEEP) await rm(CACHE_DIR, { recursive: true, force: true });

  const env = { ...process.env, SERVER_PORT: String(PORT) };
  if (CLAUDE_DIR) env.CLAUDE_DIR = CLAUDE_DIR;
  if (COWORK_DIR) env.COWORK_DIR = COWORK_DIR;
  if (CACHE_DIR) env.DASHBOARD_CACHE_DIR = CACHE_DIR;

  const t0 = performance.now();
  const child = spawn('npx', ['tsx', 'server/index.ts'], {
    env, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32',
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const row = { run };
  for (const p of PROBES) {
    row[p] = await waitFor(`http://localhost:${PORT}${p}`, t0);
    console.log(`  run ${run} | ${p} -> ${Number.isNaN(row[p]) ? 'TIMEOUT' : (row[p] / 1000).toFixed(2) + 's'}`);
  }
  results.push(row);

  killTree(child);
  await sleep(1500);

  const store = log.match(/\[store\][^\n]*/g);
  if (store) for (const l of store.slice(0, 4)) console.log(`  run ${run} | ${l.trim()}`);
}

const pad = (s, n) => String(s).padEnd(n);
console.log('\n  ' + pad('probe', 30) + results.map((r) => pad('run ' + r.run, 12)).join(''));
console.log('  ' + '-'.repeat(30 + 12 * results.length));
for (const p of PROBES) {
  console.log('  ' + pad(p, 30) + results.map((r) => pad((r[p] / 1000).toFixed(2) + 's', 12)).join(''));
}
console.log('');
// The killed child's stdio pipes keep the event loop alive; exit explicitly.
process.exit(0);
