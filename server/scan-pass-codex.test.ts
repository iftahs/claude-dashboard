import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GUARDIAN_DENY_TOOL, parseCodexFileRows } from './scan-pass-codex.ts';
import { mergeRows } from './merge.ts';
import { buildErrors, buildRejections, buildSubagentStats } from './insights.ts';
import type { FileRows } from './scan-pass.ts';

// Synthetic rollouts only — every id, path and message below is made up.
const PARENT = '00000000-0000-4000-8000-00000000aaaa';
const GUARDIAN = '00000000-0000-4000-8000-00000000bbbb';
const T0 = Date.parse('2026-09-01T10:00:00.000Z');
const NOW = T0 + 3600_000;

/** One rollout line, keys in the order Codex writes them (the parser's header regex depends on it). */
function line(ordinal: number, type: string, payload: object, offsetSec = ordinal): string {
  return JSON.stringify({ timestamp: new Date(T0 + offsetSec * 1000).toISOString(), ordinal, type, payload });
}

async function parse(threadId: string, lines: string[]): Promise<FileRows> {
  const dir = mkdtempSync(join(tmpdir(), 'codex-scan-test-'));
  try {
    const path = join(dir, `rollout-2026-09-01T10-00-00-${threadId}.jsonl`);
    writeFileSync(path, lines.join('\n') + '\n');
    const st = statSync(path);
    return await parseCodexFileRows({ path, source: 'codex', mtimeMs: st.mtimeMs, size: st.size });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const verdict = (v: object) => JSON.stringify(v);

function parentLines(): string[] {
  let n = 0;
  return [
    line(n++, 'session_meta', { id: PARENT, cwd: 'C:/work/demo', thread_source: 'user', source: 'vscode' }),
    line(n++, 'event_msg', { type: 'task_started', turn_id: '11111111-1111-4111-8111-111111111111' }),
    line(n++, 'turn_context', { turn_id: '11111111-1111-4111-8111-111111111111', model: 'gpt-test', cwd: 'C:/work/demo' }),
    line(n++, 'token_usage_record', {
      response_id: 'resp_1', turn_id: '11111111-1111-4111-8111-111111111111',
      usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 10 },
    }),
    // The user declined an apply_patch touching two files.
    line(n++, 'event_msg', {
      type: 'item_completed', turn_id: '11111111-1111-4111-8111-111111111111',
      item: { type: 'FileChange', id: 'fc_declined', status: 'declined', changes: { 'C:/work/demo/a.ts': { type: 'update' }, 'C:/work/demo/b.ts': { type: 'add' } } },
    }),
    line(n++, 'event_msg', {
      type: 'item_completed', turn_id: '11111111-1111-4111-8111-111111111111',
      item: { type: 'FileChange', id: 'fc_ok', status: 'completed', changes: { 'C:/work/demo/c.ts': { type: 'update' } } },
    }),
    line(n++, 'event_msg', {
      type: 'item_completed', turn_id: '11111111-1111-4111-8111-111111111111',
      item: { type: 'FileChange', id: 'fc_failed', status: 'failed', changes: { 'C:/work/demo/d.ts': { type: 'update' } } },
    }),
    line(n++, 'event_msg', {
      type: 'item_completed', turn_id: '11111111-1111-4111-8111-111111111111',
      item: { type: 'CommandExecution', id: 'cmd_declined', status: 'declined', parsed_cmd: [{ type: 'unknown', cmd: 'make deploy' }] },
    }),
    // A user thread's final message is prose — even one that happens to look like a verdict is not a review.
    line(n++, 'event_msg', {
      type: 'task_complete', turn_id: '11111111-1111-4111-8111-111111111111',
      last_agent_message: verdict({ outcome: 'deny' }),
    }),
  ];
}

function guardianLines(): string[] {
  let n = 0;
  const turn = (id: string, msg: string | null) => [
    line(n++, 'event_msg', { type: 'task_started', turn_id: id }),
    line(n++, 'turn_context', { turn_id: id, model: 'codex-auto-review' }),
    line(n++, 'token_usage_record', { response_id: `resp_${id}`, turn_id: id, usage: { input_tokens: 50, output_tokens: 5 } }),
    line(n++, 'event_msg', { type: 'task_complete', turn_id: id, last_agent_message: msg }),
  ];
  return [
    line(n++, 'session_meta', {
      id: GUARDIAN, session_id: PARENT, parent_thread_id: PARENT, thread_source: 'guardian_review', cwd: 'C:/work/demo',
    }),
    ...turn('g-turn-1', verdict({ outcome: 'allow', risk_level: 'low', user_authorization: 'high', rationale: 'SECRET-RATIONALE-ALLOW' })),
    ...turn('g-turn-2', verdict({ outcome: 'deny', risk_level: 'high', user_authorization: 'low', rationale: 'SECRET-RATIONALE-DENY' })),
    ...turn('g-turn-3', null), // interrupted: no verdict, no review
    ...turn('g-turn-4', verdict({ outcome: 'allow' })), // older verdicts carry the outcome only
  ];
}

test('declined items are rejections, not errors and not successes', async () => {
  const rows = await parse(PARENT, parentLines());
  const result = (id: string) => rows.toolResults.find((r) => r.toolId === id);

  assert.deepEqual(
    { isError: result('fc_declined')?.isError, rejected: result('fc_declined')?.rejected },
    { isError: false, rejected: true },
  );
  assert.equal(result('fc_declined#1'), undefined, 'a declined patch is one decision, not one per file');
  assert.equal(result('cmd_declined')?.rejected, true);
  assert.equal(result('cmd_declined')?.isError, false);
  assert.equal(result('fc_ok')?.rejected, false);
  assert.equal(result('fc_ok')?.isError, false);
  assert.equal(result('fc_failed')?.isError, true);
  assert.equal(result('fc_failed')?.rejected, false);

  assert.equal(rows.sessions[0].rejectionCount, 2);
  assert.equal(rows.sessions[0].errorCount, 1);
  assert.equal(rows.taskSpawns.length, 0, 'a user thread task_complete is never a guardian review');
  assert.ok(!rows.toolCalls.some((t) => t.name === GUARDIAN_DENY_TOOL));

  const insights = mergeRows([rows], []).insights;
  const rejections = buildRejections(insights, 30, NOW);
  assert.equal(rejections.total, 2);
  assert.deepEqual(
    rejections.perTool.map((t) => [t.name, t.rejections, t.calls]).sort(),
    [['Bash', 1, 1], ['Edit', 1, 3]],
  );
  assert.equal(buildErrors(insights, 30, NOW).categories.rejected, 2);
});

test('each guardian verdict is one review; a deny is a rejected call on the parent thread', async () => {
  const rows = await parse(GUARDIAN, guardianLines());

  assert.deepEqual(
    rows.taskSpawns.map((s) => s.toolId),
    [`${GUARDIAN}:g-turn-1`, `${GUARDIAN}:g-turn-2`, `${GUARDIAN}:g-turn-4`],
  );
  for (const s of rows.taskSpawns) {
    assert.equal(s.sessionId, PARENT);
    assert.equal(s.subagentType, 'guardian_review');
    assert.equal(s.model, 'codex-auto-review');
    assert.equal(s.projectPath, 'c:\\work\\demo');
  }

  assert.equal(rows.toolCalls.length, 1);
  const deny = rows.toolCalls[0];
  assert.deepEqual(
    { toolId: deny.toolId, name: deny.name, sessionId: deny.sessionId, isSidechain: deny.isSidechain },
    { toolId: `${GUARDIAN}:g-turn-2`, name: GUARDIAN_DENY_TOOL, sessionId: PARENT, isSidechain: false },
  );

  assert.deepEqual(
    rows.toolResults.map((r) => [r.toolId, r.rejected, r.isError, r.agentIdFromResult]),
    [
      [`${GUARDIAN}:g-turn-1`, false, false, GUARDIAN],
      [`${GUARDIAN}:g-turn-2`, true, false, GUARDIAN],
      [`${GUARDIAN}:g-turn-4`, false, false, GUARDIAN],
    ],
  );
  assert.equal(rows.sessions[0].rejectionCount, 1);
  assert.equal(rows.sessions[0].fileIsSidechain, true);
  assert.ok(!JSON.stringify(rows).includes('SECRET-RATIONALE'), 'the verdict rationale is never stored');
});

test('merge counts reviews, not reviewer threads', async () => {
  const parent = await parse(PARENT, parentLines());
  const guardian = await parse(GUARDIAN, guardianLines());
  const { insights } = mergeRows([parent, guardian], []);

  assert.equal(insights.taskSpawns.length, 3);
  assert.ok(insights.taskSpawns.every((t) => t.completed && t.agentIdFromResult === GUARDIAN));

  const sm = insights.sessionsMeta.get(PARENT);
  assert.ok(sm);
  assert.equal(sm.isSidechain, false, 'the parent rollout stays authoritative');
  assert.equal(sm.subagentSpawns, 3);
  assert.equal(sm.rejectionCount, 3, 'two declined items + one guardian deny');

  const stats = buildSubagentStats(insights, 30, NOW);
  assert.equal(stats.spawns, 3);
  assert.equal(stats.byType.guardian_review, 3);
  assert.equal(stats.delegationRate, 1);

  const rejections = buildRejections(insights, 30, NOW);
  assert.equal(rejections.total, 3);
  assert.deepEqual(
    rejections.perTool.find((t) => t.name === GUARDIAN_DENY_TOOL),
    { name: GUARDIAN_DENY_TOOL, calls: 1, rejections: 1 },
  );
});

test('review ids are unique per verdict, so merge dedups a rollout seen twice', async () => {
  const guardian = await parse(GUARDIAN, guardianLines());
  const { insights } = mergeRows([guardian, guardian], []);
  assert.equal(insights.taskSpawns.length, 3);
  assert.equal(insights.toolCalls.filter((t) => t.name === GUARDIAN_DENY_TOOL).length, 1);
});
