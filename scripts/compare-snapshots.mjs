#!/usr/bin/env node
/**
 * compare-snapshots.mjs — diff two snapshot dirs produced by snapshot-endpoints.mjs.
 *
 *   node scripts/compare-snapshots.mjs baseline phase1
 *
 * Reports per-file: identical / differs / missing. For differing files it prints the
 * first few differing JSON paths so a regression is immediately locatable.
 *
 * The insights duplicate-inflation fix (see CHANGELOG) intentionally lowers three
 * counters. Pass --allow-insights-counters to treat changes confined to those keys
 * as expected rather than as regressions.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
if (!a || !b) {
  console.error('usage: node scripts/compare-snapshots.mjs <labelA> <labelB> [--allow-insights-counters]');
  process.exit(1);
}
const allowCounters = process.argv.includes('--allow-insights-counters');

/** Keys whose values legitimately change when the duplicate-inflation bug is fixed. */
const COUNTER_KEYS = new Set([
  'assistantMsgs', 'toolCallCount', 'subagentSpawns', 'totalCalls', 'calls',
  'count', 'spawns', 'total', 'msgs',
]);

const dirA = join(process.cwd(), 'snapshots', a);
const dirB = join(process.cwd(), 'snapshots', b);

function diffPaths(x, y, path = '', out = []) {
  if (out.length >= 8) return out;
  if (x === y) return out;
  const bothObj = x && y && typeof x === 'object' && typeof y === 'object';
  if (!bothObj) {
    out.push(`${path || '<root>'}: ${JSON.stringify(x)} -> ${JSON.stringify(y)}`);
    return out;
  }
  if (Array.isArray(x) !== Array.isArray(y)) {
    out.push(`${path}: array/object mismatch`);
    return out;
  }
  if (Array.isArray(x)) {
    if (x.length !== y.length) out.push(`${path}.length: ${x.length} -> ${y.length}`);
    for (let i = 0; i < Math.min(x.length, y.length) && out.length < 8; i++) {
      diffPaths(x[i], y[i], `${path}[${i}]`, out);
    }
    return out;
  }
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (out.length >= 8) break;
    diffPaths(x[k], y[k], path ? `${path}.${k}` : k, out);
  }
  return out;
}

/** True when every differing leaf sits under one of the known counter keys. */
function onlyCounters(diffs) {
  return diffs.length > 0 && diffs.every((d) => {
    const lhs = d.split(':')[0];
    return [...COUNTER_KEYS].some((k) => lhs.includes(k));
  });
}

const filesA = (await readdir(dirA)).filter((f) => f.endsWith('.json')).sort();
let same = 0, expected = 0;
const regressions = [];

for (const f of filesA) {
  let ja, jb;
  try {
    ja = JSON.parse(await readFile(join(dirA, f), 'utf8'));
  } catch { continue; }
  try {
    jb = JSON.parse(await readFile(join(dirB, f), 'utf8'));
  } catch {
    regressions.push({ f, diffs: ['MISSING in ' + b] });
    continue;
  }
  const sa = JSON.stringify(ja), sb = JSON.stringify(jb);
  if (sa === sb) { same++; continue; }
  const diffs = diffPaths(ja, jb);
  if (allowCounters && onlyCounters(diffs)) { expected++; continue; }
  regressions.push({ f, diffs });
}

console.log(`\n${a} vs ${b}`);
console.log(`  identical           : ${same}/${filesA.length}`);
if (allowCounters) console.log(`  expected (counters) : ${expected}`);
console.log(`  REGRESSIONS         : ${regressions.length}`);
for (const r of regressions) {
  console.log(`\n  ✗ ${r.f}`);
  for (const d of r.diffs) console.log(`      ${d}`);
}
console.log('');
process.exit(regressions.length ? 1 : 0);
