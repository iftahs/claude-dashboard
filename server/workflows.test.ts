import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TMP = mkdtempSync(join(tmpdir(), 'dash-workflows-'));
process.env.CLAUDE_DIR = TMP;
after(() => rmSync(TMP, { recursive: true, force: true }));

const PROJECTS = join(TMP, 'projects');
const SESSION = join(PROJECTS, 'C--demo', '11111111-2222-3333-4444-555555555555');
const RUN = 'wf_synthetic1';

mkdirSync(join(SESSION, 'workflows'), { recursive: true });
mkdirSync(join(SESSION, 'subagents', 'workflows', RUN), { recursive: true });
writeFileSync(join(SESSION, 'workflows', `${RUN}.json`), JSON.stringify({
  runId: RUN, workflowName: 'synthetic', status: 'completed', startTime: Date.UTC(2026, 8, 1), durationMs: 1000,
  totalTokens: 1200, agentCount: 1, defaultModel: 'claude-sonnet-4-6', phases: [],
  workflowProgress: [{ type: 'workflow_agent', agentId: 'a1', tokens: 1200, state: 'done' }],
}));
writeFileSync(join(SESSION, 'subagents', 'workflows', RUN, 'journal.jsonl'), '');

// Counts discovery walks: each one lists the projects root exactly once.
let walks = 0;
const realReaddir = fsp.readdir;
(fsp as { readdir: unknown }).readdir = (path: unknown, ...rest: unknown[]) => {
  if (path === PROJECTS) walks++;
  return (realReaddir as (...a: unknown[]) => unknown)(path, ...rest);
};
syncBuiltinESMExports();
after(() => {
  (fsp as { readdir: unknown }).readdir = realReaddir;
  syncBuiltinESMExports();
});

const { getWorkflows, getWorkflowStats, locateRun } = await import('./workflows.ts');

test('the list, the stats and a run lookup landing together share one discovery walk', async () => {
  const [list, stats, located] = await Promise.all([getWorkflows(), getWorkflowStats(), locateRun(RUN)]);
  assert.equal(walks, 1);
  assert.deepEqual(list.recent.map((r) => r.runId), [RUN]);
  assert.equal(stats.totalRuns, 1);
  assert.equal(located?.dir, join(SESSION, 'subagents', 'workflows', RUN));
  assert.equal(located?.journalPath, join(SESSION, 'workflows', `${RUN}.json`));
});

test('a lookup right after reuses that walk, and an unknown run is still not found', async () => {
  assert.ok(await locateRun(RUN));
  assert.equal(await locateRun('wf_missing'), null);
  assert.equal(await locateRun('../..'), null);
  assert.equal(walks, 1);
});
