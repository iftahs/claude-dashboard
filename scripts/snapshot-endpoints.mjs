#!/usr/bin/env node
/**
 * snapshot-endpoints.mjs — golden-snapshot harness for the scan/aggregate refactor.
 *
 * Hits every deterministic data endpoint and writes the unwrapped `data` payload
 * to snapshots/<label>/<slug>.json, so two runs can be diffed to prove a refactor
 * did not change any output.
 *
 * Volatile envelope fields (computedAt, claudeDir) are stripped — they change every
 * run by design. Live/network endpoints (/api/config, /api/usage/live, /api/version)
 * are excluded for the same reason.
 *
 * Run the server against a FROZEN copy of ~/.claude, or the underlying files will
 * change between baseline and comparison and the diff will be meaningless:
 *
 *   CLAUDE_DIR=C:/tmp/claude-freeze/.claude \
 *   COWORK_DIR=C:/tmp/claude-freeze/cowork \
 *   SERVER_PORT=8799 npx tsx server/index.ts
 *
 *   node scripts/snapshot-endpoints.mjs baseline  --base http://localhost:8799
 *   node scripts/snapshot-endpoints.mjs phase1    --base http://localhost:8799
 *   node scripts/compare-snapshots.mjs baseline phase1
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const label = process.argv[2];
if (!label) {
  console.error('usage: node scripts/snapshot-endpoints.mjs <label> [--base http://localhost:8799]');
  process.exit(1);
}
const baseIdx = process.argv.indexOf('--base');
const BASE = baseIdx !== -1 ? process.argv[baseIdx + 1] : 'http://localhost:8799';

const DAYS = 30;

/** Endpoints that honour ?source=; snapshotted once per source. */
const SOURCED = [
  '/api/usage/recent?hours=12',
  '/api/usage/weekly?days=7',
  '/api/usage/models?days=7',
  '/api/usage/contributors',
  '/api/activity',
  '/api/tools?days=7',
  '/api/heatmap?days=90',
  '/api/projects?days=90',
  '/api/sessions',
  `/api/insights/errors?days=${DAYS}`,
  `/api/insights/retries?days=${DAYS}`,
  `/api/insights/languages?days=${DAYS}`,
  `/api/insights/branches?days=${DAYS}`,
  `/api/insights/mcp?days=${DAYS}`,
  `/api/insights/complexity?days=${DAYS}`,
  `/api/insights/yield?days=${DAYS}`,
  `/api/insights/rejections?days=${DAYS}`,
  `/api/insights/subagents?days=${DAYS}`,
  `/api/insights/churn?days=${DAYS}`,
];

/** Endpoints with no source dimension. */
const PLAIN = ['/api/sources', `/api/insights/commands?days=${DAYS}`, '/api/stats/summary'];

const slug = (u) => u.replace(/^\/api\//, '').replace(/[?&=/]/g, '_');

/** Deep-sort object keys so key ordering can never cause a false diff. */
function normalize(v) {
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v).sort().map((k) => [k, normalize(v[k])])
    );
  }
  return v;
}

async function grab(url) {
  const res = await fetch(BASE + url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const env = await res.json();
  // Drop the volatile envelope fields; keep only the payload.
  return normalize(env && typeof env === 'object' && 'data' in env ? env.data : env);
}

const outDir = join(process.cwd(), 'snapshots', label);
await mkdir(outDir, { recursive: true });

const urls = [
  ...SOURCED.flatMap((u) => ['all', 'code', 'cowork'].map((s) => u + (u.includes('?') ? '&' : '?') + 'source=' + s)),
  ...PLAIN,
];

let ok = 0;
let failed = 0;
for (const u of urls) {
  try {
    const data = await grab(u);
    await writeFile(join(outDir, slug(u) + '.json'), JSON.stringify(data, null, 2));
    ok++;
  } catch (e) {
    failed++;
    console.error(`  FAIL ${u}: ${e.message}`);
  }
}

console.log(`snapshot "${label}": ${ok} ok, ${failed} failed -> snapshots/${label}/`);
process.exit(failed ? 1 : 0);
