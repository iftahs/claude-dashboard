import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INSIGHTS_MAX_FILE_BYTES, isRejectedToolResult, parseFileRows } from './scan-pass.ts';

const DECLINE =
  "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, " +
  'the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.';

const err = (content: unknown) => ({ type: 'tool_result', tool_use_id: 'toolu_x', is_error: true, content });
const ok = (content: unknown) => ({ type: 'tool_result', tool_use_id: 'toolu_x', content });

test('Claude Code decline wording on an error result is a rejection', () => {
  assert.equal(isRejectedToolResult(err(DECLINE)), true);
  assert.equal(
    isRejectedToolResult(err(DECLINE.replace(/STOP.*$/, 'The user provided the following reason for the rejection: not now'))),
    true,
    'decline with a reason',
  );
  assert.equal(isRejectedToolResult(err([{ type: 'text', text: DECLINE }])), true, 'array content');
  assert.equal(isRejectedToolResult(err(`<tool_use_error>${DECLINE}</tool_use_error>`)), true, 'wrapped');
  assert.equal(isRejectedToolResult(err('Permission for this tool use was denied. The tool use was rejected.')), true);
  assert.equal(isRejectedToolResult(err('User rejected tool use')), true);
  assert.equal(isRejectedToolResult(err('Permission to use mcp__demo__do_thing has been denied.')), true);
  assert.equal(
    isRejectedToolResult(err('Permission for this action was denied by the Claude Code auto mode classifier. Reason: demo.')),
    true,
  );
  assert.equal(
    isRejectedToolResult(err("Claude requested permissions to write to /tmp/demo.txt, but you haven't granted it yet.")),
    true,
  );
  assert.equal(isRejectedToolResult({ ...err('anything'), rejected: true }), true, 'explicit flag');
});

test('a successful result is never a rejection, whatever it says', () => {
  assert.equal(isRejectedToolResult(ok(DECLINE)), false, 'a Read of a file quoting the decline');
  assert.equal(isRejectedToolResult(ok('function reject(reason) { return Promise.reject(reason); }')), false);
  assert.equal(isRejectedToolResult(ok('Access denied for user')), false);
  assert.equal(isRejectedToolResult({ ...ok(DECLINE), is_error: false }), false);
  assert.equal(isRejectedToolResult({ ...ok('x'), rejected: true }), false, 'flag without is_error');
  assert.equal(isRejectedToolResult(null), false);
  assert.equal(isRejectedToolResult(undefined), false);
});

test('a tool that ran and failed is an error, not a rejection', () => {
  assert.equal(isRejectedToolResult(err("Exit code 1\nmv: cannot move 'a' to 'b': Permission denied")), false);
  assert.equal(isRejectedToolResult(err("EACCES: permission denied, open '/tmp/demo'")), false);
  assert.equal(isRejectedToolResult(err('Search failed — ripgrep rejected the pattern')), false);
  assert.equal(isRejectedToolResult(err('navigation to http://localhost:3000 was denied or failed')), false);
  assert.equal(isRejectedToolResult(err(`Exit code 1\n${DECLINE}`)), false, 'command output quoting the decline');
  assert.equal(isRejectedToolResult(err('')), false);
  assert.equal(isRejectedToolResult(err(undefined)), false);
});

/** One synthetic transcript: two tool calls, one declined and one whose output mentions "reject". */
function transcript(): string {
  const base = { sessionId: 'sess-1', timestamp: '2026-01-01T00:00:00.000Z' };
  const call = (id: string, name: string) => ({
    ...base, type: 'assistant', requestId: `req-${id}`,
    message: { id: `msg-${id}`, role: 'assistant', model: 'claude-demo', content: [{ type: 'tool_use', id, name, input: {} }] },
  });
  const result = (block: object) => ({ ...base, type: 'user', message: { role: 'user', content: [block] } });
  return [
    { ...base, type: 'user', message: { role: 'user', content: 'hello' } },
    call('toolu_read', 'Read'),
    result({ type: 'tool_result', tool_use_id: 'toolu_read', content: 'const rejected = await reject(); // denied' }),
    call('toolu_edit', 'Edit'),
    result({ type: 'tool_result', tool_use_id: 'toolu_edit', is_error: true, content: DECLINE }),
    { ...base, type: 'assistant', message: { role: 'assistant', model: 'claude-demo', content: [] } },
  ]
    .map((o) => JSON.stringify(o))
    .join('\n');
}

test('parseFileRows flags only the declined call and counts one rejection', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scan-pass-test-'));
  try {
    const path = join(dir, 'sess-1.jsonl');
    await writeFile(path, transcript());
    const rows = await parseFileRows({ path, source: 'code', mtimeMs: 0, size: 1 });

    const byId = new Map(rows.toolResults.map((r) => [r.toolId, r]));
    assert.deepEqual(
      { isError: byId.get('toolu_read')?.isError, rejected: byId.get('toolu_read')?.rejected },
      { isError: false, rejected: false },
    );
    assert.deepEqual(
      { isError: byId.get('toolu_edit')?.isError, rejected: byId.get('toolu_edit')?.rejected },
      { isError: true, rejected: true },
    );
    assert.equal(byId.get('toolu_edit')?.errorText, DECLINE.slice(0, 200));

    assert.equal(rows.sessions.length, 1);
    assert.equal(rows.sessions[0].rejectionCount, 1);
    assert.equal(rows.sessions[0].errorCount, 1);
    // The keyless assistant line gets a NUL-prefixed synthetic key (written as `\0` in source).
    assert.ok(rows.sessions[0].assistantKeys.some((k) => k.startsWith('\u0000keyless:')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('insight rows come from files up to INSIGHTS_MAX_FILE_BYTES', async () => {
  assert.equal(INSIGHTS_MAX_FILE_BYTES, 64 * 1024 * 1024);
  const dir = await mkdtemp(join(tmpdir(), 'scan-pass-test-'));
  try {
    const path = join(dir, 'sess-1.jsonl');
    await writeFile(path, transcript());
    // `size` is taken from the stat sweep, so it can stand in for a large file here.
    const big = await parseFileRows({ path, source: 'code', mtimeMs: 0, size: 24 * 1024 * 1024 });
    assert.equal(big.insightsSkipped, false, 'a 24 MB transcript used to be dropped at 5 MB');
    assert.equal(big.toolCalls.length, 2);

    const huge = await parseFileRows({ path, source: 'code', mtimeMs: 0, size: INSIGHTS_MAX_FILE_BYTES + 1 });
    assert.equal(huge.insightsSkipped, true);
    assert.equal(huge.toolCalls.length, 0);
    assert.equal(huge.sessions.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
