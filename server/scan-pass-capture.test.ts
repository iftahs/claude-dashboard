/**
 * History capture from Claude Code / Cowork transcripts (scan-pass.ts): effort,
 * thinking tokens, limit hits, line changes, PR links, turn timing, titles and the
 * session's cwd/client. Synthetic fixtures only; the shapes mirror real transcripts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  countInputEditLines, countPatchLines, INSIGHTS_MAX_FILE_BYTES, limitHitOf, nextWallClock, parseFileRows, TURN_CAP_MS,
  userTurnRole, type FileRows,
} from './scan-pass.ts';
import { mergeRows } from './merge.ts';
import type { UsageSource } from './scan.ts';

const T0 = Date.parse('2026-09-01T10:00:00.000Z');
const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();

let uid = 0;
const line = (sec: number, fields: object): Record<string, unknown> => ({
  sessionId: 'sess-1', timestamp: at(sec), uuid: `u-${++uid}`,
  cwd: '/work/demo', entrypoint: 'cli', version: '2.1.0', ...fields,
});
const prompt = (sec: number, content: unknown = 'do the thing', extra: object = {}) =>
  line(sec, { type: 'user', message: { role: 'user', content }, ...extra });
const reply = (
  sec: number, id: string,
  opts: { content?: unknown[]; model?: string; usage?: object; extra?: object } = {},
) => line(sec, {
  type: 'assistant', requestId: `req-${id}`,
  message: {
    id: `msg-${id}`, role: 'assistant', model: opts.model ?? 'claude-demo',
    content: opts.content ?? [{ type: 'text', text: 'ok' }],
    usage: opts.usage ?? { input_tokens: 1, output_tokens: 2 },
  },
  ...opts.extra,
});
const toolUse = (sec: number, id: string, toolId: string, name = 'Edit') =>
  reply(sec, id, { content: [{ type: 'tool_use', id: toolId, name, input: {} }] });
const toolResult = (sec: number, toolId: string, toolUseResult?: unknown) => line(sec, {
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolId, content: 'done' }] },
  ...(toolUseResult === undefined ? {} : { toolUseResult }),
});
/** The `<synthetic>` line Claude Code writes when a usage limit refuses a request. */
const refusal = (sec: number, text: string, extra: object = {}) => line(sec, {
  type: 'assistant', isApiErrorMessage: true, error: 'rate_limit', apiErrorStatus: 429,
  message: {
    id: `msg-limit-${sec}`, role: 'assistant', model: '<synthetic>',
    content: [{ type: 'text', text }], usage: { input_tokens: 0, output_tokens: 0 },
  },
  ...extra,
});

async function parse(
  lines: object[],
  opts: { source?: UsageSource; size?: number; rel?: string } = {},
): Promise<FileRows> {
  const dir = await mkdtemp(join(tmpdir(), 'scan-capture-'));
  try {
    const path = join(dir, ...(opts.rel ?? 'sess-1.jsonl').split('/'));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    return await parseFileRows({ path, source: opts.source ?? 'code', mtimeMs: 0, size: opts.size ?? 1 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// effort and thinking tokens
// ---------------------------------------------------------------------------

test('usage rows carry the top-level effort and the reported thinking tokens', async () => {
  const rows = await parse([
    reply(1, 'a', {
      extra: { effort: 'xhigh' },
      usage: { input_tokens: 1, output_tokens: 50, output_tokens_details: { thinking_tokens: 20 } },
    }),
    reply(2, 'b'),
    reply(3, 'c', {
      extra: { effort: 'high' },
      usage: { input_tokens: 1, output_tokens: 5, output_tokens_details: { thinking_tokens: 0 } },
    }),
  ]);
  const byKey = new Map(rows.usage.map((u) => [u.dedupKey, u]));
  assert.deepEqual(
    [...byKey.values()].map((u) => [u.dedupKey, u.effort, u.reasoningTokens]),
    [
      ['req-a:msg-a', 'xhigh', 20],
      ['req-b:msg-b', '', null], // not reported is unknown, not zero
      ['req-c:msg-c', 'high', 0],
    ],
  );
});

// ---------------------------------------------------------------------------
// limit hits
// ---------------------------------------------------------------------------

test('limit refusals become limit hits with their kind, reset time and model', async () => {
  const resetSec = 1_788_000_000;
  const session = refusal(10, "You've hit your session limit · resets 4am (Europe/London)", {
    quotaLimits: { status: 'rejected', rateLimitType: 'five_hour', resetsAt: resetSec },
  });
  const rows = await parse([
    reply(0, 'real', { model: 'claude-opus-demo' }),
    session,
    { ...session }, // the same line repeated (same uuid) is one hit
    refusal(20, "You've hit your weekly limit · resets 9am (Europe/London)"),
    refusal(30, "You've reached your Fable limit. Switch to another model, or turn on extra usage."),
    refusal(40, "You've hit your limit · resets 11:30pm (Europe/London)"),
    refusal(50, 'Limit reached', { quotaLimits: { rateLimitType: 'seven_day_opus', resetsAt: resetSec } }),
    // Not limit hits: another API error, and a synthetic line that is not a refusal.
    line(60, {
      type: 'assistant', isApiErrorMessage: true, error: 'authentication_failed', apiErrorStatus: 401,
      message: { id: 'm-auth', role: 'assistant', model: '<synthetic>', content: [{ type: 'text', text: 'Please run /login' }] },
    }),
    line(70, {
      type: 'assistant',
      message: { id: 'm-noop', role: 'assistant', model: '<synthetic>', content: [{ type: 'text', text: 'No response requested.' }] },
    }),
    // Older transcripts: no flags, only the synthetic text with an epoch.
    line(80, {
      type: 'assistant',
      message: {
        id: 'm-old', role: 'assistant', model: '<synthetic>',
        content: [{ type: 'text', text: `Claude AI usage limit reached|${resetSec}` }],
      },
    }),
  ]);

  const hits = rows.limitHits ?? [];
  assert.deepEqual(
    hits.map((h) => [h.ts - T0, h.kind, h.resetsAt, h.model, h.source]),
    [
      [10_000, 'session', resetSec * 1000, 'claude-opus-demo', 'code'],
      // Europe/London is on BST (UTC+1) on 2026-09-01: 9am local tomorrow is 08:00Z.
      [20_000, 'weekly', Date.parse('2026-09-02T08:00:00Z'), 'claude-opus-demo', 'code'],
      [30_000, 'model', null, 'fable', 'code'], // the capped family, not the last model that answered
      [40_000, 'unknown', Date.parse('2026-09-01T22:30:00Z'), 'claude-opus-demo', 'code'],
      [50_000, 'model', resetSec * 1000, 'claude-opus-demo', 'code'], // seven_day_opus: the Opus model itself
      [80_000, 'unknown', resetSec * 1000, 'claude-opus-demo', 'code'],
    ],
  );
  assert.equal(hits[0].key, session.uuid, 'keyed by the line uuid');
  assert.equal(hits[0].sessionId, 'sess-1');
});

test('limit hits are collected from files too large for insights', async () => {
  const lines = [
    prompt(0),
    reply(1, 'a'),
    refusal(5, "You've hit your session limit · resets 4am (Europe/London)", {
      quotaLimits: { rateLimitType: 'five_hour', resetsAt: 1_788_000_000 },
    }),
    { type: 'custom-title', customTitle: 'Big one', sessionId: 'sess-1' },
    toolResult(6, 'toolu_1', { type: 'create', filePath: '/w/x', content: 'a\n', structuredPatch: [] }),
  ];
  const rows = await parse(lines, { size: INSIGHTS_MAX_FILE_BYTES + 1 });
  assert.equal(rows.insightsSkipped, true);
  assert.equal(rows.limitHits?.length, 1);
  assert.equal(rows.limitHits?.[0].model, 'claude-demo');
  // merge.ts reads the other history rows only from insight-eligible files.
  assert.deepEqual([rows.turns?.length, rows.titles?.length, rows.lineChanges?.length], [0, 0, 0]);
});

test('limitHitOf ignores non-assistant lines and assistant lines that are not refusals', () => {
  assert.equal(limitHitOf({ type: 'user', isApiErrorMessage: true, error: 'rate_limit' }, T0), null);
  assert.equal(limitHitOf(reply(0, 'x'), T0), null);
  const quoted = reply(0, 'y', { content: [{ type: 'text', text: "You've hit your session limit" }] });
  assert.equal(limitHitOf(quoted, T0), null, 'a real model quoting the wording is not a refusal');
  // Rate-limit errors that are not a usage limit: no quota data, no limit wording.
  for (const text of [
    'API Error: Server is temporarily limiting requests (not your usage limit) · Rate limited',
    'API Error: Request rejected (429) · retry later',
    'Fable is experiencing high load right now. Please try again shortly.',
  ]) {
    assert.equal(limitHitOf(refusal(0, text), T0), null, text);
  }
});

test('a per-model limit names the capped family from quota data or its wording', async () => {
  const rows = await parse([
    reply(0, 'real', { model: 'claude-fable-5-1' }),
    refusal(10, "You've reached your Fable limit. Switch to another model."),
    refusal(20, 'Limit reached', { quotaLimits: { rateLimitType: 'seven_day_sonnet', resetsAt: 1_788_000_000 } }),
    refusal(30, "You've hit your session limit", { quotaLimits: { rateLimitType: 'five_hour' } }),
  ]);
  assert.deepEqual(rows.limitHits?.map((h) => [h.kind, h.model]), [
    ['model', 'claude-fable-5-1'], // the last model is of the capped family: keep its full name
    ['model', 'sonnet'],
    ['session', 'claude-fable-5-1'],
  ]);
  assert.equal(limitHitOf(refusal(0, "You've hit your Opus 5 limit"), T0)?.family, 'opus');
});

test('nextWallClock resolves a wall-clock reset in its time zone, across DST changes', () => {
  // Europe/London springs forward at 01:00Z on 2026-03-29 (GMT -> BST).
  const beforeSpring = Date.parse('2026-03-28T23:30:00Z');
  assert.equal(nextWallClock(beforeSpring, 0, 30, 'Europe/London'), Date.parse('2026-03-29T00:30:00Z'));
  assert.equal(nextWallClock(beforeSpring, 4, 0, 'Europe/London'), Date.parse('2026-03-29T03:00:00Z'));
  // ... and falls back at 01:00Z on 2026-10-25 (BST -> GMT).
  assert.equal(
    nextWallClock(Date.parse('2026-10-24T22:00:00Z'), 4, 0, 'Europe/London'),
    Date.parse('2026-10-25T04:00:00Z'),
  );
  // 6am EDT: 5pm is later today; 5am is tomorrow.
  const ny = Date.parse('2026-09-01T10:00:00Z');
  assert.equal(nextWallClock(ny, 17, 0, 'America/New_York'), Date.parse('2026-09-01T21:00:00Z'));
  assert.equal(nextWallClock(ny, 5, 0, 'America/New_York'), Date.parse('2026-09-02T09:00:00Z'));
  assert.equal(nextWallClock(ny, 5, 0, 'Not/AZone'), null);
});

// ---------------------------------------------------------------------------
// line changes
// ---------------------------------------------------------------------------

test('countPatchLines counts +/- hunk lines, and a created file\'s content lines', () => {
  const edit = {
    filePath: '/w/a.ts', oldString: 'x', newString: 'y',
    structuredPatch: [
      { oldStart: 1, oldLines: 3, newStart: 1, newLines: 4, lines: [' ctx', '-old', '+new', '+++not a header', ' ctx', '\\ No newline at end of file'] },
      { oldStart: 9, oldLines: 1, newStart: 10, newLines: 0, lines: ['-gone'] },
    ],
  };
  assert.deepEqual(countPatchLines(edit), { added: 2, removed: 2 });
  assert.deepEqual(countPatchLines({ type: 'create', filePath: '/w/b', content: 'a\nb\nc\n', structuredPatch: [] }), { added: 3, removed: 0 });
  assert.deepEqual(countPatchLines({ type: 'create', filePath: '/w/c', content: 'a\nb' }), { added: 2, removed: 0 });
  assert.deepEqual(countPatchLines({ type: 'create', filePath: '/w/d', content: '', structuredPatch: [] }), { added: 0, removed: 0 });
  assert.deepEqual(
    countPatchLines({ type: 'update', filePath: '/w/b', content: 'A\nb\n', structuredPatch: [{ lines: ['-a', '+A', ' b'] }] }),
    { added: 1, removed: 1 },
  );
  assert.equal(countPatchLines('Error: file not found'), null);
  assert.equal(countPatchLines([{ type: 'text', text: 'x' }]), null);
  assert.equal(countPatchLines({ type: 'text', file: { filePath: '/w/a.ts' } }), null, 'a Read result');
  assert.equal(countPatchLines(null), null);
});

test('edit results become line-change rows keyed by tool_use id', async () => {
  const patch = { filePath: '/w/a.ts', structuredPatch: [{ lines: ['-a', '+A', '+B'] }] };
  const rows = await parse([
    prompt(0),
    toolUse(1, 'e', 'toolu_edit'),
    toolResult(2, 'toolu_edit', patch),
    toolUse(3, 'w', 'toolu_write', 'Write'),
    toolResult(4, 'toolu_write', { type: 'create', filePath: '/w/new.md', content: 'one\ntwo\n', structuredPatch: [] }),
    toolUse(5, 'r', 'toolu_read', 'Read'),
    toolResult(6, 'toolu_read', { type: 'text', file: { filePath: '/w/a.ts', content: '+x\n-y' } }),
    toolResult(7, 'toolu_fail', 'Error: String to replace not found'),
    toolResult(8, 'toolu_edit', patch), // the same result repeated
  ]);
  assert.deepEqual(
    rows.lineChanges?.map((c) => [c.key, c.ts - T0, c.filePath, c.added, c.removed, c.sessionId, c.source]),
    [
      ['toolu_edit', 2000, '/w/a.ts', 2, 1, 'sess-1', 'code'],
      ['toolu_write', 4000, '/w/new.md', 2, 0, 'sess-1', 'code'],
    ],
  );
});

test('countInputEditLines estimates an edit from its input', () => {
  assert.deepEqual(countInputEditLines('Write', { file_path: '/w/a', content: 'a\nb\nc\n' }), { added: 3, removed: 0 });
  assert.deepEqual(
    countInputEditLines('Edit', { file_path: '/w/a', old_string: 'keep\nold\nkeep too', new_string: 'keep\nnew\nnewer\nkeep too' }),
    { added: 2, removed: 1 },
    'lines shared at both ends are not changes',
  );
  assert.deepEqual(countInputEditLines('Edit', { old_string: 'x', new_string: 'y' }), { added: 1, removed: 1 });
  assert.deepEqual(countInputEditLines('Edit', { old_string: 'a\nb', new_string: 'a\nb\nc' }), { added: 1, removed: 0 });
  assert.deepEqual(countInputEditLines('Edit', { old_string: 'gone\n', new_string: '' }), { added: 0, removed: 1 });
  assert.deepEqual(
    countInputEditLines('MultiEdit', { edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'c', new_string: 'c\nd' }, {}] }),
    { added: 2, removed: 1 },
  );
  assert.equal(countInputEditLines('Edit', {}), null, 'a streaming placeholder with no input yet');
  assert.equal(countInputEditLines('Read', { file_path: '/w/a' }), null);
});

test('edits without a structured result (subagent transcripts) count from their input', async () => {
  const edit = (sec: number, id: string, toolId: string, name: string, input: object) =>
    reply(sec, id, { content: [{ type: 'tool_use', id: toolId, name, input }] });
  const failed = line(9, {
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_bad', is_error: true, content: 'String not found' }] },
  });
  const rows = await parse([
    prompt(0),
    reply(1, 'p', { content: [{ type: 'tool_use', id: 'toolu_w', name: 'Write', input: {} }] }), // placeholder
    edit(2, 'p', 'toolu_w', 'Write', { file_path: '/w/new.ts', content: 'one\ntwo\n' }),
    toolResult(3, 'toolu_w'),
    edit(4, 'e', 'toolu_e', 'Edit', { file_path: '/w/a.ts', old_string: 'a\nb', new_string: 'a\nB\nC' }),
    toolResult(5, 'toolu_e', 'The file /w/a.ts has been updated.'), // a string result, as subagents log
    edit(6, 's', 'toolu_s', 'Edit', { file_path: '/w/s.ts', old_string: 'x', new_string: 'y' }),
    toolResult(7, 'toolu_s', { filePath: '/w/s.ts', structuredPatch: [{ lines: ['-x', '+y', '+z'] }] }), // exact wins
    edit(8, 'b', 'toolu_bad', 'Edit', { file_path: '/w/b.ts', old_string: 'q', new_string: 'r' }),
    failed,
  ], { rel: 'sess-1/subagents/agent-abc123.jsonl' });
  assert.deepEqual(
    rows.lineChanges?.map((c) => [c.key, c.ts - T0, c.filePath, c.added, c.removed]),
    [
      ['toolu_w', 3000, '/w/new.ts', 2, 0],
      ['toolu_e', 5000, '/w/a.ts', 2, 1],
      ['toolu_s', 7000, '/w/s.ts', 2, 1],
    ],
  );
});

// ---------------------------------------------------------------------------
// PR links
// ---------------------------------------------------------------------------

test('pr-link records and git-operation PRs become PR rows, one per URL', async () => {
  const prLink = line(5, {
    type: 'pr-link', prNumber: 7, prUrl: 'https://github.com/acme/widgets/pull/7', prRepository: 'acme/widgets',
  });
  const rows = await parse([
    prompt(0),
    prLink,
    { ...prLink, timestamp: at(9) },
    toolResult(6, 'toolu_pr', { stdout: '', gitOperation: { pr: { number: 8, url: 'https://github.com/acme/gadgets/pull/8', action: 'created' } } }),
    toolResult(7, 'toolu_close', { stdout: '', gitOperation: { pr: { number: 8, action: 'closed' } } }), // no URL
  ]);
  assert.deepEqual(
    rows.prLinks?.map((p) => [p.url, p.ts - T0, p.number, p.repo, p.sessionId]),
    [
      ['https://github.com/acme/widgets/pull/7', 5000, 7, 'acme/widgets', 'sess-1'],
      ['https://github.com/acme/gadgets/pull/8', 6000, 8, 'acme/gadgets', 'sess-1'],
    ],
  );
});

// ---------------------------------------------------------------------------
// turn timing
// ---------------------------------------------------------------------------

test('userTurnRole tells prompts from tool results, markers and meta lines', () => {
  assert.equal(userTurnRole(prompt(0)), 'prompt');
  assert.equal(userTurnRole(prompt(0, [{ type: 'image' }])), 'prompt', 'an image-only prompt');
  assert.equal(userTurnRole(prompt(0, '<command-name>/review</command-name>')), 'prompt');
  assert.equal(userTurnRole(prompt(0, '<task-notification>done</task-notification>')), 'prompt');
  assert.equal(userTurnRole(toolResult(0, 'toolu_1')), 'work');
  assert.equal(userTurnRole(prompt(0, [{ type: 'text', text: '[Request interrupted by user]' }])), 'work');
  assert.equal(userTurnRole(prompt(0, '<local-command-stdout>ok</local-command-stdout>')), null);
  assert.equal(userTurnRole(prompt(0, 'context', { isMeta: true })), null);
  assert.equal(userTurnRole(prompt(0, 'context', { isMeta: true }), true), 'prompt', 'queued input being delivered');
  assert.equal(userTurnRole(prompt(0, 'summary', { isCompactSummary: true, isVisibleInTranscriptOnly: true })), null);
  assert.equal(userTurnRole(reply(0, 'a')), null);
});

test('a turn runs from its prompt to the last assistant line or tool result before the next prompt', async () => {
  const p1 = prompt(0);
  const p4 = prompt(6000);
  const p5 = prompt(9000, 'wake up', { isMeta: true });
  const p6 = prompt(20_000);
  const rows = await parse([
    { type: 'queue-operation', operation: 'enqueue', sessionId: 'sess-1', timestamp: at(0) },
    { type: 'queue-operation', operation: 'dequeue', sessionId: 'sess-1', timestamp: at(0) },
    p1,
    reply(4, 'a'), // first reply: ttft 4s
    toolUse(5, 'b', 'toolu_1', 'Bash'),
    toolResult(20, 'toolu_1'), // a tool result is part of the turn, not a new prompt
    reply(30, 'c'), // last activity: 30s
    line(31, { type: 'system', subtype: 'stop_hook_summary' }),
    // Written long after the turn ended; none of these extend it.
    prompt(3600, 'Caveat: the messages below were generated by local commands', { isMeta: true }),
    line(3600, { type: 'attachment', attachment: { type: 'date' } }),
    prompt(4000, '<command-name>/model</command-name>'), // nothing answers it: not a turn
    prompt(4001, '<local-command-stdout>Set model</local-command-stdout>'),
    prompt(5000), // answered only by a limit refusal: not a turn
    refusal(5001, "You've hit your session limit · resets 4am (Europe/London)"),
    p4,
    reply(6010, 'd'),
    prompt(6100, [{ type: 'text', text: '[Request interrupted by user]' }]), // the turn ran until here
    { type: 'queue-operation', operation: 'dequeue', sessionId: 'sess-1', timestamp: at(9000) },
    p5, // queued input delivered as a meta line still starts a turn
    reply(9005, 'e'),
    p6,
    reply(20_001, 'f'),
    toolUse(20_002, 'g', 'toolu_2', 'ExitPlanMode'),
    toolResult(20_002 + 10 * 3600, 'toolu_2'), // left waiting for 10 hours: clamped
  ]);
  assert.deepEqual(
    rows.turns?.map((t) => [t.key, t.ts - T0, t.durationMs, t.ttftMs, t.sessionId, t.source]),
    [
      [p1.uuid, 0, 30_000, 4000, 'sess-1', 'code'],
      [p4.uuid, 6_000_000, 100_000, 10_000, 'sess-1', 'code'],
      [p5.uuid, 9_000_000, 5000, 5000, 'sess-1', 'code'],
      [p6.uuid, 20_000_000, TURN_CAP_MS, 1000, 'sess-1', 'code'],
    ],
  );
  assert.equal(TURN_CAP_MS, 6 * 3600 * 1000);
});

test('repeated prompts, older lines and other sessions never stretch a turn', async () => {
  const p = prompt(100);
  const q = prompt(200);
  const rows = await parse([
    p,
    reply(110, 'a'),
    { ...p }, // the same prompt repeated (same uuid) is not a new turn
    reply(50, 'old'), // history older than the prompt
    line(150, { type: 'assistant', isSidechain: true, message: { id: 's', role: 'assistant', model: 'claude-demo', content: [] } }),
    q,
    reply(205, 'b'),
    line(900, {
      type: 'assistant', sessionId: 'sess-other',
      message: { id: 'o', role: 'assistant', model: 'claude-demo', content: [] },
    }),
  ]);
  assert.deepEqual(rows.turns?.map((t) => [t.key, t.durationMs, t.ttftMs]), [
    [p.uuid, 10_000, 10_000],
    [q.uuid, 5000, 5000],
  ]);
});

test('a synthetic line written long after a turn ended does not stretch it', async () => {
  const p1 = prompt(0);
  const p2 = prompt(4 * 86_400, 'wake up', { isMeta: true });
  const p3 = prompt(5 * 86_400);
  const noResponse = (sec: number) => line(sec, {
    type: 'assistant',
    message: { id: `m-noop-${sec}`, role: 'assistant', model: '<synthetic>', content: [{ type: 'text', text: 'No response requested.' }] },
  });
  const rows = await parse([
    p1,
    reply(10, 'a'),
    reply(20, 'b'),
    { type: 'queue-operation', operation: 'dequeue', sessionId: 'sess-1', timestamp: at(4 * 86_400 - 5) },
    noResponse(4 * 86_400 - 4), // days later, between the dequeue and the delivered input
    p2,
    reply(4 * 86_400 + 3, 'c'),
    refusal(4 * 86_400 + 9, "You've hit your session limit · resets 4am (Europe/London)"), // ends that turn
    noResponse(5 * 86_400 - 1),
    p3,
    reply(5 * 86_400 + 2, 'd'),
  ]);
  assert.deepEqual(rows.turns?.map((t) => [t.key, t.durationMs, t.ttftMs]), [
    [p1.uuid, 20_000, 10_000],
    [p2.uuid, 9000, 3000],
    [p3.uuid, 2000, 2000],
  ]);
});

test('subagent transcripts produce no turns', async () => {
  const rows = await parse([prompt(0), reply(3, 'a')], { rel: 'sess-1/subagents/agent-abc123.jsonl' });
  assert.equal(rows.usage.length, 1);
  assert.deepEqual(rows.turns, []);
});

// ---------------------------------------------------------------------------
// titles and session fields
// ---------------------------------------------------------------------------

test('title records (no timestamp) are kept in file order, and a custom title wins', async () => {
  const rows = await parse([
    { type: 'ai-title', aiTitle: 'Fix the parser', sessionId: 'sess-1' },
    prompt(0),
    { type: 'custom-title', customTitle: '  Parser rewrite  ', sessionId: 'sess-1' },
    { type: 'ai-title', aiTitle: 'Later generated title', sessionId: 'sess-1' },
    { type: 'custom-title', customTitle: '', sessionId: 'sess-1' },
    { type: 'custom-title', customTitle: 'No session' },
  ]);
  assert.deepEqual(rows.titles, [
    { sessionId: 'sess-1', title: 'Fix the parser', kind: 'ai', seq: 0 },
    { sessionId: 'sess-1', title: 'Parser rewrite', kind: 'custom', seq: 2 },
    { sessionId: 'sess-1', title: 'Later generated title', kind: 'ai', seq: 3 },
  ]);
  const { insights } = mergeRows([rows], []);
  assert.equal(insights.sessionsMeta.get('sess-1')?.title, 'Parser rewrite');
});

test('sessions record the first cwd, client and version; Cowork keeps no cwd', async () => {
  const lines = [
    { type: 'queue-operation', operation: 'enqueue', sessionId: 'sess-1', timestamp: at(0) },
    prompt(1, 'hi', { cwd: '/work/demo', entrypoint: 'claude-desktop', version: '2.1.5' }),
    reply(2, 'a', { extra: { cwd: '/work/other', entrypoint: 'cli', version: '2.1.6' } }),
  ];
  const code = await parse(lines);
  assert.deepEqual(
    code.sessions.map((s) => [s.cwd, s.client, s.clientVersion]),
    [['/work/demo', 'claude-desktop', '2.1.5']],
  );
  const cowork = await parse(lines, { source: 'cowork' });
  assert.deepEqual(
    cowork.sessions.map((s) => [s.cwd, s.client, s.clientVersion]),
    [['', 'claude-desktop', '2.1.5']],
  );
});

test("a prompt Dispatch relays keeps its turn in the worker's own session", async () => {
  const relayed = { uuid: 'relayed-prompt' };
  const orchestrator = await parse([
    prompt(0, 'fix it', { sessionId: 'orch', ...relayed }),
    reply(5, 'o', { extra: { sessionId: 'orch' } }),
    reply(3600, 'o2', { extra: { sessionId: 'orch' } }),
  ], { source: 'cowork', rel: 'acct/prof/agent/local_ditto_1/.claude/projects/x/orch.jsonl' });
  const worker = await parse([
    prompt(1, 'fix it', { sessionId: 'worker', ...relayed }),
    reply(61, 'w', { extra: { sessionId: 'worker' } }),
  ], { source: 'cowork', rel: 'acct/prof/local_1/.claude/projects/x/worker.jsonl' });

  // The orchestrator lists first (agent/ sorts before local_), yet the worker's copy wins.
  const { insights } = mergeRows([orchestrator, worker], []);
  assert.deepEqual(insights.turns.map((t) => [t.sessionId, t.durationMs]), [['worker', 60_000]]);
  assert.equal(insights.sessionsMeta.get('worker')?.activeMs, 60_000);
  assert.equal(insights.sessionsMeta.get('orch')?.activeMs, 0);
});

test('a resumed transcript repeating the same history does not double-count after merge', async () => {
  const p = prompt(0);
  const history = [
    p,
    toolUse(1, 'e', 'toolu_edit'),
    toolResult(2, 'toolu_edit', { filePath: '/w/a.ts', structuredPatch: [{ lines: ['-a', '+A', '+B'] }] }),
    line(3, { type: 'pr-link', prNumber: 7, prUrl: 'https://github.com/acme/widgets/pull/7', prRepository: 'acme/widgets' }),
    reply(4, 'done'),
  ];
  const first = await parse(history);
  const resumed = await parse([...history, prompt(100), reply(160, 'more')]);
  const { insights } = mergeRows([first, resumed], []);
  const sm = insights.sessionsMeta.get('sess-1');
  assert.deepEqual(
    [sm?.linesAdded, sm?.linesRemoved, sm?.prUrls, sm?.activeMs],
    [2, 1, ['https://github.com/acme/widgets/pull/7'], 4000 + 60_000],
  );
});
