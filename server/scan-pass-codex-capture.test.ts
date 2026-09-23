import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyLimitHit, countUnifiedDiff, parseCodexFileRows } from './scan-pass-codex.ts';
import { mergeRows } from './merge.ts';
import type { FileRows, RateLimitSnapRow } from './scan-pass.ts';

// Synthetic rollouts only — every id, path, URL and diff below is made up.
const THREAD = '00000000-0000-4000-8000-00000000c001';
const GUARDIAN = '00000000-0000-4000-8000-00000000c002';
const TURN_A = '11111111-1111-4111-8111-00000000000a';
const TURN_B = '11111111-1111-4111-8111-00000000000b';
const TURN_C = '11111111-1111-4111-8111-00000000000c';
const T0 = Date.parse('2026-09-01T10:00:00.000Z');
const T0_SEC = T0 / 1000;

/** One rollout line, keys in the order Codex writes them (the parser's header regex depends on it). */
function line(ordinal: number, type: string, payload: object, offsetSec = ordinal): string {
  return JSON.stringify({ timestamp: new Date(T0 + offsetSec * 1000).toISOString(), ordinal, type, payload });
}

async function parse(threadId: string, lines: string[]): Promise<FileRows> {
  const dir = mkdtempSync(join(tmpdir(), 'codex-capture-test-'));
  try {
    const path = join(dir, `rollout-2026-09-01T10-00-00-${threadId}.jsonl`);
    writeFileSync(path, lines.join('\n') + '\n');
    const st = statSync(path);
    return await parseCodexFileRows({ path, source: 'codex', mtimeMs: st.mtimeMs, size: st.size });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const meta = (extra: object = {}) => ({ id: THREAD, cwd: 'C:/work/demo', thread_source: 'user', ...extra });

/** A Codex-bucket rate_limits block: 5-hour primary, weekly secondary, resets in epoch seconds. */
function rl(primaryPct: number, secondaryPct: number, extra: object = {}) {
  return {
    limit_id: 'codex', limit_name: null, plan_type: 'plus',
    primary: { used_percent: primaryPct, window_minutes: 300, resets_at: T0_SEC + 3600 },
    secondary: { used_percent: secondaryPct, window_minutes: 10080, resets_at: T0_SEC + 5 * 86400 },
    credits: null, individual_limit: null, rate_limit_reached_type: null, spend_control_reached: null,
    ...extra,
  };
}
const premiumProbe = { limit_id: 'premium', limit_name: null, plan_type: 'plus', primary: null, secondary: null };
const tokenCount = (rateLimits: object | null) => ({ type: 'token_count', info: null, rate_limits: rateLimits });

// ---------------------------------------------------------------------------
// effort + reasoning tokens
// ---------------------------------------------------------------------------

test('effort joins by turn_id like the model; reasoning tokens come from the usage record', async () => {
  let n = 0;
  const rows = await parse(THREAD, [
    line(n++, 'session_meta', meta()),
    line(n++, 'event_msg', { type: 'thread_settings_applied', thread_id: THREAD, thread_settings: { model: 'gpt-settings', reasoning_effort: 'medium' } }),
    // A record can precede its own turn_context — the join is deferred.
    line(n++, 'token_usage_record', {
      response_id: 'resp_a', turn_id: TURN_A,
      usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 30, reasoning_output_tokens: 12 },
    }),
    line(n++, 'turn_context', { turn_id: TURN_A, model: 'gpt-a', effort: 'high' }),
    line(n++, 'turn_context', { turn_id: TURN_B, model: 'gpt-b', collaboration_mode: { settings: { reasoning_effort: 'low' } } }),
    line(n++, 'token_usage_record', { response_id: 'resp_b', turn_id: TURN_B, usage: { input_tokens: 10, output_tokens: 5 } }),
    // No turn_context for this turn: the thread settings are the fallback.
    line(n++, 'token_usage_record', { response_id: 'resp_c', turn_id: TURN_C, usage: { input_tokens: 10, output_tokens: 5, reasoning_output_tokens: 0 } }),
  ]);
  const by = (k: string) => rows.usage.find((u) => u.dedupKey === `codex:${k}`)!;
  assert.deepEqual([by('resp_a').model, by('resp_a').effort, by('resp_a').reasoningTokens], ['gpt-a', 'high', 12]);
  assert.deepEqual([by('resp_b').model, by('resp_b').effort, by('resp_b').reasoningTokens], ['gpt-b', 'low', undefined]);
  assert.deepEqual([by('resp_c').model, by('resp_c').effort, by('resp_c').reasoningTokens], ['gpt-settings', 'medium', 0]);

  const events = mergeRows([rows], []).events;
  const ev = (model: string) => events.find((e) => e.model === model)!;
  assert.equal(ev('gpt-a').effort, 'high');
  assert.equal(ev('gpt-a').reasoningTokens, 12);
  assert.equal(ev('gpt-b').reasoningTokens, null, 'unreported reasoning stays unknown, not 0');
});

test('legacy token_count rows get effort and reasoning tokens too', async () => {
  let n = 0;
  const rows = await parse(THREAD, [
    line(n++, 'session_meta', meta()),
    line(n++, 'event_msg', { type: 'task_started', turn_id: TURN_A }),
    line(n++, 'turn_context', { turn_id: TURN_A, model: 'gpt-old', effort: 'xhigh' }),
    line(n++, 'event_msg', {
      type: 'token_count',
      info: { last_token_usage: { input_tokens: 50, cached_input_tokens: 10, output_tokens: 20, reasoning_output_tokens: 7 } },
      rate_limits: null,
    }),
  ]);
  assert.equal(rows.usage.length, 1);
  assert.deepEqual([rows.usage[0].model, rows.usage[0].effort, rows.usage[0].reasoningTokens], ['gpt-old', 'xhigh', 7]);
  assert.deepEqual(rows.rateLimitSnaps, [], 'rate_limits: null is no snapshot');
});

// ---------------------------------------------------------------------------
// rate-limit snapshots
// ---------------------------------------------------------------------------

test('rate-limit snapshots: seconds → ms, identical repeats skipped per bucket', async () => {
  let n = 0;
  const rows = await parse(THREAD, [
    line(n++, 'session_meta', meta()),
    line(n++, 'event_msg', tokenCount(rl(10, 20))),
    line(n++, 'event_msg', tokenCount(rl(10, 20))), // exact repeat → skipped
    line(n++, 'event_msg', tokenCount(premiumProbe)),
    line(n++, 'event_msg', tokenCount(rl(10, 20))), // still a repeat of the last Codex-bucket reading
    line(n++, 'event_msg', tokenCount(premiumProbe)), // repeat of the last premium reading
    line(n++, 'event_msg', tokenCount(rl(11, 20))), // changed → kept
    line(n++, 'event_msg', tokenCount(rl(10, 20))), // changed back → kept
    // Older CLIs: no limit_id (the Codex bucket), plan go = weekly primary and no secondary.
    line(n++, 'event_msg', tokenCount({ plan_type: 'go', primary: { used_percent: 5, window_minutes: 10080, resets_at: T0_SEC + 86400 }, secondary: null })),
  ]);
  const snaps = rows.rateLimitSnaps ?? [];
  assert.deepEqual(
    snaps.map((s) => [s.key, s.limitId, s.primaryPct, s.secondaryPct]),
    [
      [`${T0 + 1000}|codex`, 'codex', 10, 20],
      [`${T0 + 3000}|premium`, 'premium', null, null],
      [`${T0 + 6000}|codex`, 'codex', 11, 20],
      [`${T0 + 7000}|codex`, 'codex', 10, 20],
      [`${T0 + 8000}|codex`, 'codex', 5, null],
    ],
  );
  const first = snaps[0];
  assert.deepEqual(
    [first.ts, first.primaryWindowMin, first.primaryResetsAt, first.secondaryWindowMin, first.secondaryResetsAt, first.planType],
    [T0 + 1000, 300, T0 + 3600_000, 10080, T0 + 5 * 86400_000, 'plus'],
  );
  assert.equal(snaps[4].planType, 'go');

  const merged = mergeRows([rows, rows], []).insights.rateLimitSnaps;
  assert.equal(merged.length, 5, 'a rollout seen twice adds no snapshots');
});

// ---------------------------------------------------------------------------
// usage-limit hits
// ---------------------------------------------------------------------------

function limitHitThread(snapshots: object[], extraTurns: string[] = []): string[] {
  let n = 0;
  return [
    line(n++, 'session_meta', meta()),
    line(n++, 'event_msg', { type: 'task_started', turn_id: TURN_A }),
    line(n++, 'turn_context', { turn_id: TURN_A, model: 'gpt-limit', effort: 'high' }),
    ...snapshots.map((s) => line(n++, 'event_msg', tokenCount(s))),
    line(n++, 'event_msg', {
      type: 'task_complete', turn_id: TURN_A, last_agent_message: null,
      error: { codex_error_info: 'usage_limit_exceeded', message: 'made-up limit message' },
      started_at: T0_SEC + 1, completed_at: T0_SEC + n, duration_ms: 900, time_to_first_token_ms: null,
    }),
    ...extraTurns,
  ];
}

test('a usage_limit_exceeded turn is a limit hit, classified past the premium probe', async () => {
  // The real pattern: the last Codex reading is just under 100, then a null-window premium probe.
  const rows = await parse(THREAD, limitHitThread([rl(97, 30), rl(99, 30), premiumProbe]));
  assert.deepEqual(rows.limitHits, [{
    key: TURN_A, ts: T0 + 6000, sessionId: THREAD, source: 'codex',
    kind: 'session', model: 'gpt-limit', resetsAt: T0 + 3600_000,
  }]);
  assert.ok(!JSON.stringify(rows).includes('made-up limit message'), 'the error text is never stored');
  // The failed turn still took time.
  assert.deepEqual(rows.turns?.map((t) => [t.key, t.durationMs, t.ttftMs]), [[TURN_A, 900, null]]);

  const insights = mergeRows([rows, rows], []).insights;
  assert.equal(insights.limitHits.length, 1, 'dedup by turn id');
});

test('limit kind is read from window length, not slot', () => {
  const at = T0 + 60_000;
  const snap = (s: Partial<RateLimitSnapRow>): RateLimitSnapRow => ({
    key: 'k', ts: T0, limitId: 'codex',
    primaryPct: null, primaryWindowMin: null, primaryResetsAt: null,
    secondaryPct: null, secondaryWindowMin: null, secondaryResetsAt: null,
    planType: 'plus', ...s,
  });
  const weekReset = T0 + 3 * 86400_000;

  // 'go' plan: the PRIMARY slot is the weekly window.
  assert.deepEqual(
    classifyLimitHit(snap({ primaryPct: 100, primaryWindowMin: 10080, primaryResetsAt: weekReset }), null, at),
    { kind: 'weekly', resetsAt: weekReset },
  );
  // Weekly (secondary) full, 5h half-used.
  assert.deepEqual(
    classifyLimitHit(snap({
      primaryPct: 40, primaryWindowMin: 300, primaryResetsAt: T0 + 3600_000,
      secondaryPct: 99, secondaryWindowMin: 10080, secondaryResetsAt: weekReset,
    }), null, at),
    { kind: 'weekly', resetsAt: weekReset },
  );
  // Both full: the longer window lifts later, so it is the binding one.
  assert.equal(classifyLimitHit(snap({
    primaryPct: 100, primaryWindowMin: 300, primaryResetsAt: T0 + 3600_000,
    secondaryPct: 100, secondaryWindowMin: 10080, secondaryResetsAt: weekReset,
  }), null, at).kind, 'weekly');
  // A per-model bucket reporting a full window.
  assert.deepEqual(
    classifyLimitHit(
      snap({ primaryPct: 60, primaryWindowMin: 300, primaryResetsAt: T0 + 3600_000 }),
      snap({ limitId: 'premium', primaryPct: 100, primaryWindowMin: 10080, primaryResetsAt: weekReset }),
      at,
    ),
    { kind: 'model', resetsAt: weekReset },
  );
  // Nothing close to full, no snapshot at all, or a full window that has since reset.
  const unknown = { kind: 'unknown', resetsAt: null };
  assert.deepEqual(classifyLimitHit(snap({ primaryPct: 50, primaryWindowMin: 300, primaryResetsAt: T0 + 3600_000 }), null, at), unknown);
  assert.deepEqual(classifyLimitHit(null, null, at), unknown);
  assert.deepEqual(classifyLimitHit(snap({ primaryPct: 100, primaryWindowMin: 300, primaryResetsAt: T0 + 1000 }), null, at), unknown);
  // A premium probe with null windows is no evidence either way.
  assert.deepEqual(classifyLimitHit(null, snap({ limitId: 'premium' }), at), unknown);
});

test('a limit hit with no snapshot is unknown; guardian threads record none', async () => {
  const bare = await parse(THREAD, limitHitThread([]));
  assert.deepEqual(bare.limitHits?.map((h) => [h.kind, h.resetsAt, h.model]), [['unknown', null, 'gpt-limit']]);

  let n = 0;
  const guardian = await parse(GUARDIAN, [
    line(n++, 'session_meta', { id: GUARDIAN, session_id: THREAD, parent_thread_id: THREAD, thread_source: 'guardian_review' }),
    line(n++, 'turn_context', { turn_id: TURN_B, model: 'codex-auto-review', effort: 'low' }),
    line(n++, 'event_msg', tokenCount(rl(99, 10))),
    line(n++, 'event_msg', {
      type: 'task_complete', turn_id: TURN_B, last_agent_message: null,
      error: { codex_error_info: 'usage_limit_exceeded', message: 'x' }, duration_ms: 50, time_to_first_token_ms: 10,
    }),
  ]);
  assert.deepEqual(guardian.limitHits, [], 'the parent turn records the same wall');
  assert.deepEqual(guardian.turns, [], 'review latency is not a user turn');
  assert.equal(guardian.rateLimitSnaps?.length, 1, 'guardian snapshots are still account readings');
  assert.equal(guardian.taskSpawns.length, 0, 'an errored review with no verdict reviewed nothing');
});

// ---------------------------------------------------------------------------
// turn latency
// ---------------------------------------------------------------------------

test('turn rows: user turns with a duration, keyed by turn id, started_at in seconds', async () => {
  let n = 0;
  const rows = await parse(THREAD, [
    line(n++, 'session_meta', meta()),
    line(n++, 'event_msg', {
      type: 'task_complete', turn_id: TURN_A, last_agent_message: 'done',
      started_at: T0_SEC + 10, completed_at: T0_SEC + 70, duration_ms: 60_000, time_to_first_token_ms: 1_500,
    }, 70),
    // No started_at: ts backs off from the completion line by the duration.
    line(n++, 'event_msg', { type: 'task_complete', turn_id: TURN_B, last_agent_message: 'done', duration_ms: 4_000 }, 100),
    // No duration: no row.
    line(n++, 'event_msg', { type: 'task_complete', turn_id: TURN_C, last_agent_message: 'done' }, 110),
    // A replayed turn id repeats a turn recorded elsewhere.
    line(n++, 'event_msg', { type: 'task_complete', turn_id: 'rollout-3', last_agent_message: 'done', duration_ms: 9 }, 120),
  ]);
  assert.deepEqual(
    rows.turns?.map((t) => [t.key, t.ts, t.durationMs, t.ttftMs, t.sessionId]),
    [
      [TURN_A, T0 + 10_000, 60_000, 1_500, THREAD],
      [TURN_B, T0 + 96_000, 4_000, null, THREAD],
    ],
  );
  assert.equal(rows.taskSpawns.length, 0);
  const sm = mergeRows([rows, rows], []).insights.sessionsMeta.get(THREAD);
  assert.equal(sm?.activeMs, 64_000, 'a rollout seen twice is counted once');
});

// ---------------------------------------------------------------------------
// line changes
// ---------------------------------------------------------------------------

test('countUnifiedDiff walks hunks by their declared length', () => {
  // A removed SQL comment line reads '--- ' inside the hunk; the real file headers sit outside it.
  const diff = [
    '--- a/q.sql', '+++ b/q.sql',
    '@@ -1,3 +1,3 @@', ' select 1;', '--- old comment', '+-- new comment', ' select 2;',
    '@@ -10 +10,2 @@', '-x', '+y', '++++ z', '\\ No newline at end of file', '',
  ].join('\n');
  assert.deepEqual(countUnifiedDiff(diff), { added: 3, removed: 2 });
  // No hunk headers: count +/- lines, skipping the file headers.
  assert.deepEqual(countUnifiedDiff('--- a/f\n+++ b/f\n+one\n+two\n-three\n'), { added: 2, removed: 1 });
  assert.deepEqual(countUnifiedDiff(''), { added: 0, removed: 0 });
});

test('line changes: diffs for updates, content for adds and deletes, nothing for declined or failed', async () => {
  let n = 0;
  const item = (id: string, status: string, changes: object) => line(n++, 'event_msg', {
    type: 'item_completed', turn_id: TURN_A, item: { type: 'FileChange', id, status, changes, stdout: '', stderr: '' },
  });
  const rows = await parse(THREAD, [
    line(n++, 'session_meta', meta()),
    item('fc_1', 'completed', {
      'C:/work/demo/a.ts': { type: 'update', move_path: null, unified_diff: '@@ -1,2 +1,3 @@\n keep\n-SECRET-OLD\n+SECRET-NEW\n+SECRET-MORE\n' },
      'C:/work/demo/b.ts': { type: 'add', content: 'l1\nl2\nl3\n' },
      'C:/work/demo/c.ts': { type: 'delete', content: 'gone1\ngone2' },
      'C:/work/demo/d.ts': { type: 'update', move_path: 'C:/work/demo/e.ts' }, // pure rename: nothing to count
    }),
    item('fc_declined', 'declined', { 'C:/work/demo/x.ts': { type: 'add', content: 'no\n' } }),
    item('fc_failed', 'failed', { 'C:/work/demo/y.ts': { type: 'update', unified_diff: '@@ -1 +1 @@\n-a\n+b\n' } }),
  ]);
  assert.deepEqual(
    rows.lineChanges?.map((l) => [l.key, l.filePath, l.added, l.removed, l.sessionId, l.source]),
    [
      ['fc_1|C:/work/demo/a.ts', 'C:\\work\\demo\\a.ts', 2, 1, THREAD, 'codex'],
      ['fc_1|C:/work/demo/b.ts', 'C:\\work\\demo\\b.ts', 3, 0, THREAD, 'codex'],
      ['fc_1|C:/work/demo/c.ts', 'C:\\work\\demo\\c.ts', 0, 2, THREAD, 'codex'],
    ],
  );
  assert.ok(!JSON.stringify(rows).includes('SECRET-'), 'diff text is never stored');
  // The tool rows are unchanged: four edits, one rejection, one error.
  assert.equal(rows.toolCalls.length, 6);

  const sm = mergeRows([rows, rows], []).insights.sessionsMeta.get(THREAD);
  assert.deepEqual([sm?.linesAdded, sm?.linesRemoved], [5, 3]);
});

// ---------------------------------------------------------------------------
// session fields
// ---------------------------------------------------------------------------

test('session partial carries client, version, repo and branch; the branch reaches usage and tool rows', async () => {
  let n = 0;
  const rows = await parse(THREAD, [
    line(n++, 'session_meta', meta({
      originator: 'Codex Desktop', cli_version: '0.999.0',
      git: { commit_hash: 'abc123', branch: 'feat/demo', repository_url: 'https://user:tok3n@git.example.com/org/demo.git' },
    })),
    line(n++, 'turn_context', { turn_id: TURN_A, model: 'gpt-a', effort: 'high' }),
    line(n++, 'token_usage_record', { response_id: 'resp_1', turn_id: TURN_A, usage: { input_tokens: 10, output_tokens: 5 } }),
    line(n++, 'event_msg', {
      type: 'item_completed', turn_id: TURN_A,
      item: { type: 'CommandExecution', id: 'cmd_1', status: 'completed', exit_code: 0, parsed_cmd: [{ type: 'unknown', cmd: 'ls' }] },
    }),
  ]);
  const s = rows.sessions[0];
  assert.deepEqual(
    [s.client, s.clientVersion, s.repoUrl, s.gitBranch],
    ['Codex Desktop', '0.999.0', 'https://git.example.com/org/demo.git', 'feat/demo'],
  );
  assert.ok(!JSON.stringify(rows).includes('tok3n'), 'credentials in a remote URL are stripped');
  assert.equal(rows.usage[0].gitBranch, 'feat/demo');
  assert.equal(rows.toolCalls[0].gitBranch, 'feat/demo');

  const sm = mergeRows([rows], []).insights.sessionsMeta.get(THREAD);
  assert.deepEqual([sm?.client, sm?.clientVersion, sm?.repoUrl, sm?.gitBranch], ['Codex Desktop', '0.999.0', 'https://git.example.com/org/demo.git', 'feat/demo']);

  const plain = await parse(THREAD, [line(0, 'session_meta', meta())]);
  assert.deepEqual(
    [plain.sessions[0].client, plain.sessions[0].clientVersion, plain.sessions[0].repoUrl, plain.sessions[0].gitBranch],
    [undefined, undefined, undefined, ''],
  );
});
