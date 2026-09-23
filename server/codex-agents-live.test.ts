import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  codexKindLabel,
  codexMainSignals,
  codexSubagentKind,
  computeLiveCodexAgents,
  ingestRollout,
  newThreadState,
} from './codex-agents-live.ts';
import { MAIN_ACTIVE, mainAgentState } from './subagents-live.ts';

// Synthetic rollout records only — same envelope as the real ones:
// {"timestamp", "type", "payload"} in that key order (the prefilter regexes rely on it).
const iso = (ms: number) => new Date(ms).toISOString();
const rec = (at: number, type: string, payload: object) => JSON.stringify({ timestamp: iso(at), type, payload });

const TURN = '0199aaaa-bbbb-4ccc-8ddd-eeeeffff0001';
const TURN2 = '0199aaaa-bbbb-4ccc-8ddd-eeeeffff0002';

const sessionMeta = (at: number, id: string, extra: object = {}) =>
  rec(at, 'session_meta', { id, timestamp: iso(at), cwd: 'C:\\dev\\app', cli_version: '0.153.1', ...extra });
const taskStarted = (at: number, turn = TURN) => rec(at, 'event_msg', { type: 'task_started', turn_id: turn });
const turnContext = (at: number, policy: string, reviewer: string | null, turn = TURN) =>
  rec(at, 'turn_context', {
    turn_id: turn,
    model: 'gpt-6',
    approval_policy: policy,
    ...(reviewer === null ? {} : { approvals_reviewer: reviewer }),
  });
const call = (at: number, callId: string) =>
  rec(at, 'response_item', { type: 'function_call', id: 'fc', name: 'shell', arguments: '{"cmd":"ls \\"call_id\\":\\"fake\\""}', call_id: callId });
const output = (at: number, callId: string) =>
  rec(at, 'response_item', { type: 'function_call_output', id: 'fo', call_id: callId, output: 'done' });
const item = (at: number, it: object, turn = TURN) =>
  rec(at, 'event_msg', { type: 'item_completed', thread_id: 't', turn_id: turn, item: it });
const taskComplete = (at: number, extra: object = {}, turn = TURN) =>
  rec(at, 'event_msg', { type: 'task_complete', turn_id: turn, ...extra });

async function stateFrom(lines: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'codex-agents-'));
  const file = join(dir, 'rollout-2026-09-23T10-00-00-0199aaaa-bbbb-4ccc-8ddd-eeeeffff9999.jsonl');
  writeFileSync(file, lines.join('\n') + '\n');
  const st = newThreadState(file);
  await ingestRollout(st, statSync(file).size);
  rmSync(dir, { recursive: true, force: true });
  return st;
}

const T0 = Date.parse('2026-09-23T10:00:00.000Z');

test('a line split across two reads is parsed once, when it completes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'codex-agents-'));
  try {
    const file = join(dir, 'rollout-2026-09-23T10-00-00-0199aaaa-bbbb-4ccc-8ddd-eeeeffff9999.jsonl');
    const done = taskComplete(T0 + 4000) + '\n';
    writeFileSync(file, [sessionMeta(T0, 'u1'), taskStarted(T0 + 1000)].join('\n') + '\n' + done.slice(0, 60));
    const st = newThreadState(file);
    await ingestRollout(st, statSync(file).size);
    assert.equal(st.openTurnId, TURN);
    appendFileSync(file, done.slice(60));
    await ingestRollout(st, statSync(file).size);
    assert.equal(st.openTurnId, null);
    assert.equal(st.lastTaskCompleteTs, T0 + 4000);
    assert.equal(st.offset, statSync(file).size);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the fallback title skips the attachment manifest and keeps the typed request', async () => {
  const manifest = '# Files mentioned by the user:\n\n## shot.png: C:\\tmp\\shot.png\n\n## My request for Codex:\n';
  const userMessage = (at: number, content: object[]) => item(at, { type: 'UserMessage', id: `u${at}`, content });
  const st = await stateFrom([
    sessionMeta(T0, 'u1'),
    userMessage(T0 + 1000, [{ type: 'text', text: manifest }, { type: 'local_image', path: 'C:\\tmp\\shot.png' }]),
    userMessage(T0 + 2000, [{ type: 'text', text: `${manifest}Align   the\nheader` }]),
  ]);
  assert.equal(st.firstUserText, 'Align the header');
});

test('subagent kinds and card names', () => {
  assert.equal(codexSubagentKind({ subagent: 'review' }), 'review');
  assert.equal(codexSubagentKind({ subagent: { thread_spawn: { parent_thread_id: 'x' } } }), 'thread_spawn');
  assert.equal(codexSubagentKind({ subagent: { other: 'guardian' } }), 'guardian');
  assert.equal(codexSubagentKind({}), 'subagent');
  assert.equal(codexKindLabel('guardian'), 'Guardian review');
  assert.equal(codexKindLabel('thread_spawn'), 'Spawned agent');
  assert.equal(codexKindLabel('memory_writer'), 'Memory writer');
});

test('a cleanly finished turn is "your turn" — never waiting', async () => {
  const st = await stateFrom([
    sessionMeta(T0, 'u1', { git: { branch: 'feat/x', commit_hash: 'abc', repository_url: 'https://h/r' } }),
    taskStarted(T0 + 1000),
    turnContext(T0 + 1001, 'on-request', 'user'),
    call(T0 + 2000, 'c1'),
    output(T0 + 3000, 'c1'),
    item(T0 + 3500, { type: 'AgentMessage', id: 'a', content: [] }),
    taskComplete(T0 + 4000),
  ]);
  assert.equal(st.meta?.gitBranch, 'feat/x');
  const now = T0 + 4000 + 90_000;
  const sig = codexMainSignals(st, now);
  assert.deepEqual(sig, { openTurn: false, needsUser: false, turnEnded: true });
  const s = mainAgentState({ sinceWrite: now - st.lastTs, selfActive: false, runningChildren: 0, ...sig });
  assert.equal(s.yourTurn, true);
  assert.equal(s.traffic, 'finished');
});

test('an open call with no output under on-request, reviewed by the user, is a pending approval', async () => {
  const st = await stateFrom([
    sessionMeta(T0, 'u1'),
    taskStarted(T0 + 1000),
    turnContext(T0 + 1001, 'on-request', 'user'),
    call(T0 + 2000, 'c1'),
  ]);
  assert.equal(st.pendingCalls.size, 1);
  const now = T0 + 2000 + MAIN_ACTIVE + 5_000;
  const sig = codexMainSignals(st, now);
  assert.equal(sig.openTurn, true);
  assert.equal(sig.needsUser, true);
  const s = mainAgentState({ sinceWrite: now - st.lastTs, selfActive: sig.openTurn, runningChildren: 0, ...sig });
  assert.equal(s.traffic, 'waiting');
  assert.equal(s.active, false);
});

test('the same open call is just work under never, or when the Guardian reviews', async () => {
  for (const [policy, reviewer] of [['never', 'user'], ['on-request', 'auto_review']] as const) {
    const st = await stateFrom([sessionMeta(T0, 'u1'), taskStarted(T0 + 1000), turnContext(T0 + 1001, policy, reviewer), call(T0 + 2000, 'c1')]);
    const now = T0 + 2000 + MAIN_ACTIVE + 5_000;
    const sig = codexMainSignals(st, now);
    assert.equal(sig.needsUser, false, `${policy}/${reviewer}`);
    const s = mainAgentState({ sinceWrite: now - st.lastTs, selfActive: sig.openTurn, runningChildren: 0, ...sig });
    assert.equal(s.traffic, 'running');
    assert.equal(s.active, true);
  }
});

test('the reviewer falls back to the thread settings when the turn context omits it', async () => {
  const st = await stateFrom([
    sessionMeta(T0, 'u1'),
    rec(T0 + 500, 'event_msg', { type: 'thread_settings_applied', thread_settings: { approval_policy: 'on-request', approvals_reviewer: 'auto_review' } }),
    taskStarted(T0 + 1000),
    turnContext(T0 + 1001, 'on-request', null),
    call(T0 + 2000, 'c1'),
  ]);
  assert.equal(codexMainSignals(st, T0 + 60_000).needsUser, false);
});

test('a turn that failed (usage limit) needs the user until a new turn starts', async () => {
  const lines = [
    sessionMeta(T0, 'u1'),
    taskStarted(T0 + 1000),
    turnContext(T0 + 1001, 'never', 'user'),
    taskComplete(T0 + 2000, { error: { message: 'limit', codex_error_info: 'usage_limit_exceeded' } }),
  ];
  const failed = await stateFrom(lines);
  assert.deepEqual(codexMainSignals(failed, T0 + 60_000), { openTurn: false, needsUser: true, turnEnded: false });
  const retried = await stateFrom([...lines, taskStarted(T0 + 70_000, TURN2)]);
  assert.equal(codexMainSignals(retried, T0 + 75_000).needsUser, false);
});

test('a decline by the user is red until the agent answers; a Guardian decline never is', async () => {
  const declined = (reviewer: string) => [
    sessionMeta(T0, 'u1'),
    taskStarted(T0 + 1000),
    turnContext(T0 + 1001, 'on-request', reviewer),
    call(T0 + 2000, 'c1'),
    item(T0 + 3000, { type: 'FileChange', id: 'f', changes: {}, status: 'declined' }),
    output(T0 + 3001, 'c1'),
    taskComplete(T0 + 3500),
  ];
  const byUser = await stateFrom(declined('user'));
  assert.equal(codexMainSignals(byUser, T0 + 60_000).needsUser, true);
  const byGuardian = await stateFrom(declined('auto_review'));
  assert.equal(codexMainSignals(byGuardian, T0 + 60_000).needsUser, false);
  const answered = await stateFrom([
    ...declined('user').slice(0, -1),
    item(T0 + 3200, { type: 'AgentMessage', id: 'a', content: [] }),
    taskComplete(T0 + 3500),
  ]);
  assert.deepEqual(codexMainSignals(answered, T0 + 60_000), { openTurn: false, needsUser: false, turnEnded: true });
});

test('a quoted "call_id" inside the arguments string is not mistaken for the real one', async () => {
  const st = await stateFrom([sessionMeta(T0, 'u1'), taskStarted(T0 + 1000), call(T0 + 2000, 'real'), output(T0 + 3000, 'real')]);
  assert.equal(st.pendingCalls.size, 0);
});

// ── End to end over a synthetic ~/.codex ────────────────────────────────────

test('guardian and delegated subagents are told apart and nest under their thread', async () => {
  const root = mkdtempSync(join(tmpdir(), 'codex-agents-live-'));
  const prevDir = process.env.CODEX_DIR;
  try {
    process.env.CODEX_DIR = root;
    const now = Date.now();
    const day = join(root, 'sessions', '2026', '09', '23');
    mkdirSync(day, { recursive: true });
    const USER = '0199aaaa-0000-4000-8000-000000000001';
    const GUARD = '0199aaaa-0000-4000-8000-000000000002';
    const SPAWN = '0199aaaa-0000-4000-8000-000000000003';
    const file = (id: string) => join(day, `rollout-2026-09-23T10-00-00-${id}.jsonl`);

    // User thread: an open turn, quiet for a while — hosting running subagents.
    writeFileSync(
      file(USER),
      [
        sessionMeta(now - 10 * 60_000, USER, { git: { branch: 'main' } }),
        taskStarted(now - 5 * 60_000 + 1000),
        turnContext(now - 5 * 60_000 + 1001, 'on-request', 'auto_review'),
        call(now - 4 * 60_000, 'c1'),
      ].join('\n') + '\n',
    );
    // Guardian reviewing that call, still working.
    writeFileSync(
      file(GUARD),
      [
        sessionMeta(now - 60_000, GUARD, { thread_source: 'guardian_review', parent_thread_id: USER, source: { subagent: { other: 'guardian' } } }),
        taskStarted(now - 50_000),
        turnContext(now - 50_000, 'never', 'user'),
      ].join('\n') + '\n',
    );
    // A delegated agent that already finished.
    writeFileSync(
      file(SPAWN),
      [
        sessionMeta(now - 3 * 60_000, SPAWN, { source: { subagent: { thread_spawn: { parent_thread_id: USER } } } }),
        taskStarted(now - 170_000),
        item(now - 169_000, { type: 'UserMessage', id: 'u', content: [{ type: 'text', text: 'Write the migration' }] }),
        taskComplete(now - 120_000),
      ].join('\n') + '\n',
    );

    const data = await computeLiveCodexAgents(now);
    assert.equal(data.mainAgents.length, 1);
    const main = data.mainAgents[0];
    assert.equal(main.gitBranch, 'main');
    assert.equal(main.delegating || main.active, true);
    assert.equal(main.traffic, 'running'); // the Guardian decides here — not the user

    assert.equal(data.running.length, 1);
    assert.equal(data.running[0].name, 'Guardian review');
    assert.equal(data.running[0].parentKey, file(USER));

    assert.equal(data.recentlyCompleted.length, 1);
    assert.equal(data.recentlyCompleted[0].name, 'Spawned agent');
    assert.equal(data.recentlyCompleted[0].description, 'Write the migration');
    assert.equal(data.recentlyCompleted[0].parentKey, file(USER));

    assert.deepEqual(data.counts, { running: 2, waiting: 0, finished: 1, yourTurn: 0 });
  } finally {
    if (prevDir === undefined) delete process.env.CODEX_DIR;
    else process.env.CODEX_DIR = prevDir;
    rmSync(root, { recursive: true, force: true });
  }
});
