import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ACTIVE_WINDOW,
  MAIN_ACTIVE,
  MAIN_LINGER,
  claudeMainSignals,
  computeLiveSubagents,
  mainAgentState,
  parseMainLines,
  sessionFileOfSidechain,
  tallyCounts,
  workflowRunOf,
} from './subagents-live.ts';

// Synthetic transcripts only.
const T0 = Date.parse('2026-09-23T10:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

const prompt = (at: number, text = 'do the thing') =>
  JSON.stringify({ type: 'user', timestamp: iso(at), cwd: 'E:\\dev\\my-app', message: { role: 'user', content: text } });
const assistant = (at: number, stop: string, content: object[] = [{ type: 'text', text: 'ok' }], extra: object = {}) =>
  JSON.stringify({
    type: 'assistant',
    timestamp: iso(at),
    requestId: `req_${at}`,
    cwd: 'E:\\dev\\my-app',
    gitBranch: 'main',
    message: { id: `msg_${at}`, model: 'claude-opus-5-5', stop_reason: stop, content, usage: { input_tokens: 10, output_tokens: 5 } },
    ...extra,
  });
const toolUse = (id: string, name: string, input: object = {}) => ({ type: 'tool_use', id, name, input });
const toolResult = (at: number, id: string, content: string, isError = false) =>
  JSON.stringify({
    type: 'user',
    timestamp: iso(at),
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] },
  });

// ── The shared state machine ────────────────────────────────────────────────

const base = { sinceWrite: 0, selfActive: false, runningChildren: 0, needsUser: false, turnEnded: false };

test('a fresh write is active; nothing else lights up', () => {
  const s = mainAgentState({ ...base, sinceWrite: 5_000, selfActive: true });
  assert.deepEqual(s, { listed: true, active: true, delegating: false, yourTurn: false, traffic: 'running' });
});

test('needsUser turns red only after the session went quiet, and never while delegating', () => {
  assert.equal(mainAgentState({ ...base, sinceWrite: 5_000, selfActive: true, needsUser: true }).traffic, 'running');
  const red = mainAgentState({ ...base, sinceWrite: MAIN_ACTIVE + 1, needsUser: true });
  assert.equal(red.traffic, 'waiting');
  assert.equal(red.active, false);
  assert.equal(red.listed, true);
  const delegating = mainAgentState({ ...base, sinceWrite: MAIN_ACTIVE + 1, needsUser: true, runningChildren: 2 });
  assert.equal(delegating.traffic, 'running');
  assert.equal(delegating.delegating, true);
  // Past the active window the session is dropped, not left red forever.
  assert.equal(mainAgentState({ ...base, sinceWrite: ACTIVE_WINDOW + 1, needsUser: true }).listed, false);
});

test('an open turn with a pending approval is waiting, not active (Codex selfActive)', () => {
  const s = mainAgentState({ ...base, sinceWrite: MAIN_ACTIVE + 1, selfActive: true, needsUser: true });
  assert.equal(s.traffic, 'waiting');
  assert.equal(s.active, false);
});

test('a finished turn is the soft "your turn" state: listed up to the active window, never red', () => {
  const s = mainAgentState({ ...base, sinceWrite: 2 * 60_000, turnEnded: true });
  assert.deepEqual(s, { listed: true, active: false, delegating: false, yourTurn: true, traffic: 'finished' });
  // Not before the session went quiet …
  assert.equal(mainAgentState({ ...base, sinceWrite: 10_000, selfActive: true, turnEnded: true }).yourTurn, false);
  // … and not after the window.
  assert.equal(mainAgentState({ ...base, sinceWrite: ACTIVE_WINDOW + 1, turnEnded: true }).listed, false);
});

test('an idle session lingers dimmed for MAIN_LINGER, then drops', () => {
  const idle = mainAgentState({ ...base, sinceWrite: MAIN_LINGER - 1 });
  assert.equal(idle.listed, true);
  assert.equal(idle.traffic, 'finished');
  assert.equal(mainAgentState({ ...base, sinceWrite: MAIN_LINGER + 1 }).listed, false);
});

test('counts.running = running subagents + mains working or delegating (the sidebar number)', () => {
  const m = (active: boolean, delegating: boolean, traffic: 'running' | 'waiting' | 'finished', yourTurn = false) => ({
    active,
    delegating,
    traffic,
    yourTurn,
  });
  const counts = tallyCounts([1, 2, 3], [1], [
    m(true, false, 'running'),
    m(false, true, 'running'),
    m(false, false, 'finished'), // idle, merely still listed
    m(false, false, 'finished', true), // your turn
    m(false, false, 'waiting'),
  ]);
  assert.deepEqual(counts, { running: 5, waiting: 1, finished: 1, yourTurn: 1 });
});

// ── Claude transcript signals ───────────────────────────────────────────────

test('end_turn after the prompt ends the turn; cwd, branch and titles are read', () => {
  const p = parseMainLines([
    JSON.stringify({ type: 'ai-title', aiTitle: 'Generated title' }),
    prompt(T0),
    assistant(T0 + 1000, 'end_turn'),
    JSON.stringify({ type: 'custom-title', customTitle: 'My rename' }),
  ]);
  assert.equal(p.main.cwd, 'E:\\dev\\my-app');
  assert.equal(p.main.gitBranch, 'main');
  assert.equal(p.main.customTitle, 'My rename');
  assert.equal(p.main.title, 'Generated title');
  assert.deepEqual(claudeMainSignals(p.main), { needsUser: false, turnEnded: true });
});

test('a new prompt after end_turn re-opens the turn', () => {
  const p = parseMainLines([prompt(T0), assistant(T0 + 1000, 'end_turn'), prompt(T0 + 5000)]);
  assert.deepEqual(claudeMainSignals(p.main), { needsUser: false, turnEnded: false });
});

test('an unresolved tool call needs the user; an unresolved Workflow/Agent call is delegation', () => {
  const bash = parseMainLines([prompt(T0), assistant(T0 + 1000, 'tool_use', [toolUse('t1', 'Bash')])]);
  assert.equal(claudeMainSignals(bash.main).needsUser, true);
  const wf = parseMainLines([prompt(T0), assistant(T0 + 1000, 'tool_use', [toolUse('t1', 'Workflow')])]);
  assert.equal(claudeMainSignals(wf.main).needsUser, false);
  const agent = parseMainLines([
    prompt(T0),
    assistant(T0 + 1000, 'tool_use', [toolUse('t1', 'Agent', { description: 'x', subagent_type: 'Explore', prompt: 'p' })]),
  ]);
  assert.equal(claudeMainSignals(agent.main).needsUser, false);
  assert.equal(agent.spawns.length, 1);
});

test('a rejection is red only while it is the last word', () => {
  const rejected = "The user doesn't want to proceed with this tool use. The tool use was rejected.";
  const last = parseMainLines([
    prompt(T0),
    assistant(T0 + 1000, 'tool_use', [toolUse('t1', 'Bash')]),
    toolResult(T0 + 2000, 't1', rejected, true),
  ]);
  assert.equal(claudeMainSignals(last.main).needsUser, true);
  // Claude answered after the rejection (feedback given) and finished: it is the user's turn.
  const answered = parseMainLines([
    prompt(T0),
    assistant(T0 + 1000, 'tool_use', [toolUse('t1', 'Bash')]),
    toolResult(T0 + 2000, 't1', rejected, true),
    assistant(T0 + 3000, 'end_turn'),
  ]);
  assert.deepEqual(claudeMainSignals(answered.main), { needsUser: false, turnEnded: true });
  // A benign failure (non-zero exit) is not a rejection.
  const failed = parseMainLines([
    prompt(T0),
    assistant(T0 + 1000, 'tool_use', [toolUse('t1', 'Bash')]),
    toolResult(T0 + 2000, 't1', 'Exit code 1', true),
  ]);
  assert.equal(claudeMainSignals(failed.main).needsUser, false);
});

test('a turn that ended in an API error / usage limit needs the user', () => {
  const p = parseMainLines([
    prompt(T0),
    JSON.stringify({
      type: 'assistant',
      timestamp: iso(T0 + 1000),
      isApiErrorMessage: true,
      error: 'rate_limit',
      message: { id: 'm', model: '<synthetic>', stop_reason: 'stop_sequence', content: [{ type: 'text', text: 'limit' }] },
    }),
  ]);
  assert.deepEqual(claudeMainSignals(p.main), { needsUser: true, turnEnded: false });
});

test('an interrupt hands the turn back to the user', () => {
  const p = parseMainLines([
    prompt(T0),
    assistant(T0 + 1000, 'tool_use', [toolUse('t1', 'Read')]),
    toolResult(T0 + 1500, 't1', 'file body'),
    JSON.stringify({ type: 'user', timestamp: iso(T0 + 2000), message: { role: 'user', content: [{ type: 'text', text: '[Request interrupted by user]' }] } }),
  ]);
  assert.deepEqual(claudeMainSignals(p.main), { needsUser: false, turnEnded: true });
});

test('sidechain paths map to their session file and workflow run on both separators', () => {
  assert.equal(sessionFileOfSidechain('/p/proj/abc/subagents/agent-a1.jsonl'), '/p/proj/abc.jsonl');
  assert.equal(sessionFileOfSidechain('C:\\p\\proj\\abc\\subagents\\workflows\\wf_x-1\\agent-a1.jsonl'), 'C:\\p\\proj\\abc.jsonl');
  assert.equal(sessionFileOfSidechain('/p/proj/abc.jsonl'), '');
  assert.equal(workflowRunOf('/p/proj/abc/subagents/workflows/wf_x-1/agent-a1.jsonl'), 'wf_x-1');
  assert.equal(workflowRunOf('/p/proj/abc/subagents/agent-a1.jsonl'), '');
});

// ── End to end over a synthetic ~/.claude ───────────────────────────────────

test('workflow agents nest under their session, which shows as delegating; a finished turn is "your turn"', async () => {
  const root = mkdtempSync(join(tmpdir(), 'subagents-live-'));
  const prevDir = process.env.CLAUDE_DIR;
  try {
    process.env.CLAUDE_DIR = root;
    const now = Date.now();
    const proj = join(root, 'projects', 'E--dev-my-app');
    const runDir = join(proj, 'sess-1', 'subagents', 'workflows', 'wf_abc-1');
    mkdirSync(runDir, { recursive: true });

    // Orchestrator session: launched a background workflow and ended its turn 35 min
    // ago — older than the 30-min parent window, so only its running agent pulls it in.
    const sess1 = join(proj, 'sess-1.jsonl');
    writeFileSync(
      sess1,
      [prompt(now - 36 * 60_000), assistant(now - 35 * 60_000, 'end_turn')].join('\n') + '\n',
    );
    utimesSync(sess1, new Date(now - 35 * 60_000), new Date(now - 35 * 60_000));

    const agentLine = (at: number) =>
      JSON.stringify({
        type: 'assistant',
        timestamp: iso(at),
        cwd: 'E:\\dev\\my-app\\.claude\\worktrees\\wf_abc-1-1',
        message: { id: `m${at}`, model: 'claude-sonnet-5', content: [], usage: { input_tokens: 100, output_tokens: 20 } },
      });
    const harnessPrompt = JSON.stringify({ type: 'user', timestamp: iso(now - 9 * 60_000), message: { role: 'user', content: 'RAW HARNESS PROMPT' } });
    writeFileSync(join(runDir, 'agent-a1.jsonl'), [harnessPrompt, agentLine(now - 20_000)].join('\n') + '\n');
    writeFileSync(join(runDir, 'agent-a1.meta.json'), JSON.stringify({ agentType: 'workflow-subagent', description: 'impl:agents', workflowPhase: 'Implement' }));
    writeFileSync(join(runDir, 'agent-a2.jsonl'), [harnessPrompt, agentLine(now - 5 * 60_000)].join('\n') + '\n');
    utimesSync(join(runDir, 'agent-a2.jsonl'), new Date(now - 5 * 60_000), new Date(now - 5 * 60_000));
    writeFileSync(join(runDir, 'agent-a2.meta.json'), JSON.stringify({ agentType: 'workflow-subagent', description: 'impl:live', workflowPhase: 'Implement' }));
    writeFileSync(
      join(runDir, 'journal.jsonl'),
      [
        { type: 'launched' },
        { type: 'started', agentId: 'a1', label: 'impl:agents' },
        { type: 'started', agentId: 'a2', label: 'impl:live' },
        { type: 'result', agentId: 'a2', result: {} },
      ].map((o) => JSON.stringify(o)).join('\n') + '\n',
    );

    // A second session that finished its turn two minutes ago.
    const sess2 = join(proj, 'sess-2.jsonl');
    writeFileSync(sess2, [prompt(now - 3 * 60_000), assistant(now - 2 * 60_000, 'end_turn')].join('\n') + '\n');
    utimesSync(sess2, new Date(now - 2 * 60_000), new Date(now - 2 * 60_000));

    const data = await computeLiveSubagents(now);

    const orchestrator = data.mainAgents.find((m) => m.key === sess1);
    assert.ok(orchestrator, 'the silent orchestrator is listed because it hosts a running workflow agent');
    assert.equal(orchestrator.delegating, true);
    assert.equal(orchestrator.traffic, 'running');
    assert.equal(orchestrator.project, 'E:\\dev\\my-app'); // the transcript cwd, not the encoded folder

    assert.equal(data.running.length, 1);
    assert.equal(data.running[0].key, 'a1');
    assert.equal(data.running[0].parentKey, sess1);
    assert.equal(data.running[0].name, 'impl:agents');
    assert.equal(data.running[0].description, 'Workflow · Implement phase');
    assert.ok(!data.running[0].description.includes('RAW HARNESS'));

    const done = data.recentlyCompleted.find((c) => c.key === 'a2');
    assert.ok(done);
    assert.equal(done.parentKey, sess1);

    const finished = data.mainAgents.find((m) => m.key === sess2);
    assert.ok(finished);
    assert.equal(finished.yourTurn, true);
    assert.equal(finished.traffic, 'finished');

    assert.deepEqual(data.counts, { running: 2, waiting: 0, finished: 1, yourTurn: 1 });
  } finally {
    if (prevDir === undefined) delete process.env.CLAUDE_DIR;
    else process.env.CLAUDE_DIR = prevDir;
    rmSync(root, { recursive: true, force: true });
  }
});

test('growing transcripts are read incrementally: appends count once, a torn last line waits for its newline', async () => {
  const root = mkdtempSync(join(tmpdir(), 'subagents-live-'));
  const prevDir = process.env.CLAUDE_DIR;
  try {
    process.env.CLAUDE_DIR = root;
    const now = Date.now();
    const proj = join(root, 'projects', 'E--dev-my-app');
    const scDir = join(proj, 'sess-1', 'subagents');
    mkdirSync(scDir, { recursive: true });
    const sess = join(proj, 'sess-1.jsonl');
    const side = join(scDir, 'agent-b1.jsonl');
    const sideLine = (at: number) =>
      JSON.stringify({
        type: 'assistant',
        timestamp: iso(at),
        message: { id: `s${at}`, model: 'claude-sonnet-5', content: [], usage: { input_tokens: 100, output_tokens: 20 } },
      });

    // Tick 1: a prompt, an Agent spawn with no result yet, and the next reply torn mid-line.
    const spawn = assistant(now - 50_000, 'tool_use', [toolUse('tu1', 'Agent', { description: 'dig', subagent_type: 'Explore', prompt: 'look' })]);
    const reply = assistant(now - 20_000, 'end_turn') + '\n';
    writeFileSync(sess, [prompt(now - 60_000), spawn].join('\n') + '\n' + reply.slice(0, 40));
    writeFileSync(side, sideLine(now - 40_000) + '\n');
    writeFileSync(join(scDir, 'agent-b1.meta.json'), JSON.stringify({ agentType: 'Explore', description: 'dig', toolUseId: 'tu1' }));
    let data = await computeLiveSubagents(now);
    assert.equal(data.mainAgents.find((m) => m.key === sess)?.effectiveTokens, 15);
    assert.equal(data.running.find((r) => r.key === 'tu1')?.effectiveTokens, 120);

    // Tick 2: the torn line completes; the spawn's result and more subagent work arrive.
    appendFileSync(sess, reply.slice(40) + toolResult(now - 10_000, 'tu1', 'done') + '\n');
    appendFileSync(side, sideLine(now - 30_000) + '\n');
    data = await computeLiveSubagents(now);
    assert.equal(data.mainAgents.find((m) => m.key === sess)?.effectiveTokens, 30);
    assert.equal(data.running.length, 0);
    assert.equal(data.recentlyCompleted.find((c) => c.key === 'tu1')?.effectiveTokens, 240);

    // A file rewritten shorter is parsed again from the start.
    writeFileSync(sess, [prompt(now - 5_000), assistant(now - 4_000, 'end_turn')].join('\n') + '\n');
    data = await computeLiveSubagents(now);
    assert.equal(data.mainAgents.find((m) => m.key === sess)?.effectiveTokens, 15);
  } finally {
    if (prevDir === undefined) delete process.env.CLAUDE_DIR;
    else process.env.CLAUDE_DIR = prevDir;
    rmSync(root, { recursive: true, force: true });
  }
});
