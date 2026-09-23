import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FileRows, SessionPartialRow, UsageRow } from './scan-pass.ts';
import type { UsageSource } from './scan.ts';
import { mergeRows } from './merge.ts';
import {
  claudeProjectPath, decodeProjectDir, firstCwdIn, legacyProjectPathFromFile, normalizeProjectPath,
  projectPathForFile, sessionTranscriptFor,
} from './project-path.ts';
import { parseSessionIndex } from './codex-titles.ts';
import {
  buildSessionRows, buildSessionSummary, legacyProjectPaths, median, searchSessions,
} from './sessions.ts';
import { capTurns, claudeTranscriptBuilder, codexTranscriptBuilder, readTranscript, type TranscriptTurn } from './transcript.ts';

// Synthetic fixtures only — never real transcripts.
const TMP = mkdtempSync(join(tmpdir(), 'dash-sessions-'));
after(() => rmSync(TMP, { recursive: true, force: true }));

const T = Date.UTC(2026, 8, 1, 10, 0, 0);
const MIN = 60_000;

// ---------------------------------------------------------------------------
// project-path.ts
// ---------------------------------------------------------------------------

test('legacy folder decode is kept exactly (it is what old tags are keyed by)', () => {
  assert.equal(decodeProjectDir('E--dev-projects-iftah-dev'), 'e:\\dev-projects-iftah-dev');
  assert.equal(decodeProjectDir('-home-me-app'), '/-home-me-app');
  assert.equal(
    legacyProjectPathFromFile('C:\\Users\\me\\.claude\\projects\\E--dev-projects-iftah-dev\\abc.jsonl'),
    'e:\\dev-projects-iftah-dev',
  );
  assert.equal(
    legacyProjectPathFromFile('/home/me/.claude/projects/E--dev-app/abc/subagents/agent-1.jsonl'),
    'e:\\dev-app',
  );
  assert.equal(legacyProjectPathFromFile('/home/me/.codex/sessions/2026/rollout-x.jsonl'), '');
});

test('normalizeProjectPath: drive letter, separators, trailing slash, worktree fold', () => {
  assert.equal(normalizeProjectPath('E:\\dev-projects\\iftah.dev'), 'e:\\dev-projects\\iftah.dev');
  assert.equal(normalizeProjectPath('E:/dev-projects/iftah.dev/'), 'e:\\dev-projects\\iftah.dev');
  assert.equal(normalizeProjectPath('C:\\'), 'c:\\');
  assert.equal(normalizeProjectPath('/home/me/app/'), '/home/me/app');
  assert.equal(
    normalizeProjectPath('E:\\dev-projects\\iftah.dev\\.claude\\worktrees\\youthful-shtern-67b35c'),
    'e:\\dev-projects\\iftah.dev',
  );
  assert.equal(normalizeProjectPath('/home/me/app/.claude/worktrees/wf_1/src'), '/home/me/app');
  assert.equal(normalizeProjectPath(''), '');
  assert.equal(claudeProjectPath('', '/x/.claude/projects/E--a-b/s.jsonl'), 'e:\\a-b', 'no cwd → legacy decode');
  assert.equal(claudeProjectPath('E:\\a.b', '/x/.claude/projects/E--a-b/s.jsonl'), 'e:\\a.b');
});

test('firstCwdIn unescapes the JSON string; sessionTranscriptFor finds the parent transcript', () => {
  assert.equal(firstCwdIn('{"type":"user","cwd":"E:\\\\dev\\\\My \\"App\\""}'), 'E:\\dev\\My "App"');
  assert.equal(firstCwdIn('{"type":"summary"}'), '');
  assert.equal(
    sessionTranscriptFor('/c/.claude/projects/E--a/sess-1/subagents/workflows/wf_1/journal.jsonl'),
    '/c/.claude/projects/E--a/sess-1.jsonl',
  );
  assert.equal(
    sessionTranscriptFor('C:\\c\\.claude\\projects\\E--a\\sess-1\\workflows\\wf_1.json'),
    'C:\\c\\.claude\\projects\\E--a\\sess-1.jsonl',
  );
  assert.equal(sessionTranscriptFor('/c/.claude/projects/E--a/sess-1.jsonl'), '/c/.claude/projects/E--a/sess-1.jsonl');
  assert.equal(sessionTranscriptFor('/c/.codex/sessions/x.jsonl'), null);
});

test('projectPathForFile reads the session transcript cwd, else falls back to the folder decode', async () => {
  const dir = join(TMP, 'claude', 'projects', 'E--dev-projects-iftah-dev');
  mkdirSync(join(dir, 'sess-1', 'workflows'), { recursive: true });
  writeFileSync(
    join(dir, 'sess-1.jsonl'),
    [
      JSON.stringify({ type: 'file-history-snapshot' }),
      JSON.stringify({ type: 'user', sessionId: 'sess-1', cwd: 'E:\\dev-projects\\iftah.dev', timestamp: new Date(T).toISOString() }),
    ].join('\n') + '\n',
  );
  assert.equal(await projectPathForFile(join(dir, 'sess-1', 'workflows', 'wf_1.json')), 'e:\\dev-projects\\iftah.dev');
  assert.equal(await projectPathForFile(join(dir, 'sess-2', 'workflows', 'wf_2.json')), 'e:\\dev-projects-iftah-dev');
});

// ---------------------------------------------------------------------------
// merge.ts project path derivation
// ---------------------------------------------------------------------------

function usage(sessionId: string, key: string, ts: number, source: UsageSource, raw: string): UsageRow {
  return {
    dedupKey: key, ts, sessionId, model: 'claude-sonnet-4-6',
    inputTokens: 100, outputTokens: 50, cacheCreateTokens: 10, cacheReadTokens: 1000,
    tools: [], isSidechain: false, rootSessionId: sessionId,
    attributionAgent: '', attributionSkill: '', attributionMcpServer: '', attributionPlugin: '',
    projectPathRaw: raw, gitBranch: '', source,
  };
}

function partial(sessionId: string, file: string, source: UsageSource, extra: Partial<SessionPartialRow> = {}): SessionPartialRow {
  return {
    sessionId, fileIsSidechain: false, firstTs: T, lastTs: T + 90 * MIN,
    turns: 4, compactions: 0, errorCount: 0, rejectionCount: 0,
    firstPrompt: `prompt of ${sessionId}`, gitBranch: 'main', projectPath: legacyProjectPathFromFile(file),
    file, agentId: null, source,
    assistantKeys: [`${sessionId}:m1`], gitCommitIds: [], gitPushIds: [], nonErrorResultIds: [],
    ...extra,
  };
}

function rows(path: string, source: UsageSource, opts: {
  sessionId: string; cwd?: string; sidechain?: boolean; insightsSkipped?: boolean; raw?: string;
  turns?: number[]; lines?: [number, number]; prs?: string[]; title?: string; corpus?: string[];
}): FileRows {
  const raw = opts.raw ?? (source === 'code' ? legacyProjectPathFromFile(path) : '');
  const r: FileRows = {
    path, source, mtimeMs: T, size: 100, insightsSkipped: !!opts.insightsSkipped,
    usage: [usage(opts.sessionId, `${path}:u1`, T, source, raw)],
    toolCalls: [{
      toolId: `${path}:t1`, ts: T, sessionId: opts.sessionId, name: 'Edit', isSidechain: !!opts.sidechain,
      mcpServer: null, filePath: `${path}.src`, gitBranch: '', projectPath: raw, source,
    }],
    toolResults: [],
    taskSpawns: [],
    sessions: opts.insightsSkipped ? [] : [partial(opts.sessionId, path, source, {
      fileIsSidechain: !!opts.sidechain,
      projectPath: raw,
      ...(opts.cwd ? { cwd: opts.cwd } : {}),
    })],
    corpus: opts.corpus ? [{ sessionId: opts.sessionId, snippets: opts.corpus }] : [],
    turns: (opts.turns ?? []).map((d, i) => ({
      key: `${opts.sessionId}:turn${i}`, ts: T + i * MIN, sessionId: opts.sessionId, source, durationMs: d, ttftMs: null,
    })),
    lineChanges: opts.lines
      ? [{ key: `${path}:edit`, ts: T, sessionId: opts.sessionId, source, filePath: `${path}.src`, added: opts.lines[0], removed: opts.lines[1] }]
      : [],
    prLinks: (opts.prs ?? []).map((url) => ({ url, ts: T, sessionId: opts.sessionId, source, number: null, repo: null })),
    titles: opts.title ? [{ sessionId: opts.sessionId, title: opts.title, kind: 'custom', seq: 1 }] : [],
  };
  return r;
}

const CLAUDE_DIR = '/home/me/.claude/projects/E--dev-projects-iftah-dev';

test('Claude project path comes from the transcript cwd, for events, tool calls and sessions', () => {
  const merged = mergeRows([
    rows(`${CLAUDE_DIR}/s1.jsonl`, 'code', { sessionId: 's1', cwd: 'E:\\dev-projects\\iftah.dev' }),
    // A usage-only file (over the insights cap): no partial, so no cwd of its own —
    // it borrows the real path other sessions in the same folder recorded.
    rows(`${CLAUDE_DIR}/s2.jsonl`, 'code', { sessionId: 's2', insightsSkipped: true }),
    rows('/cowork/a/p/s3/.claude/projects/-sandbox/s3.jsonl', 'cowork', { sessionId: 's3', cwd: '/sandbox' }),
    rows('/home/me/.codex/sessions/2026/09/01/rollout-x-c1.jsonl', 'codex', { sessionId: 'c1', raw: 'E:\\dev-projects\\iftah.dev\\' }),
  ], []);
  const byId = new Map(merged.events.map((e) => [e.sessionId, e.projectPath]));
  assert.equal(byId.get('s1'), 'e:\\dev-projects\\iftah.dev');
  assert.equal(byId.get('s2'), 'e:\\dev-projects\\iftah.dev', 'same folder, no cwd → borrowed');
  assert.equal(byId.get('s3'), '', 'Cowork stays blank');
  assert.equal(byId.get('c1'), 'e:\\dev-projects\\iftah.dev', 'Codex normalised → same project as Claude');
  assert.equal(merged.insights.sessionsMeta.get('s1')!.projectPath, 'e:\\dev-projects\\iftah.dev');
  assert.equal(merged.insights.toolCalls.find((t) => t.sessionId === 's1')!.projectPath, 'e:\\dev-projects\\iftah.dev');
});

test('a parent file beats a subagent file that sorted first: file and path', () => {
  const merged = mergeRows([
    rows(`${CLAUDE_DIR}/p1/subagents/agent-a.jsonl`, 'code', {
      sessionId: 'p1', sidechain: true, cwd: 'E:\\dev-projects\\iftah.dev\\.claude\\worktrees\\wt-1',
    }),
    rows(`${CLAUDE_DIR}/p1.jsonl`, 'code', { sessionId: 'p1', cwd: 'E:\\dev-projects\\iftah.dev' }),
  ], []);
  const sm = merged.insights.sessionsMeta.get('p1')!;
  assert.equal(sm.isSidechain, false);
  assert.equal(sm.file, `${CLAUDE_DIR}/p1.jsonl`);
  assert.equal(sm.projectPath, 'e:\\dev-projects\\iftah.dev');
});

test('a legacy sidecar path is used (normalised) when the transcript has no cwd', () => {
  const merged = mergeRows(
    [rows(`${CLAUDE_DIR}/old.jsonl`, 'code', { sessionId: 'old' })],
    [{ session_id: 'old', project_path: 'E:\\dev-projects\\iftah.dev' }],
  );
  assert.equal(merged.events[0].projectPath, 'e:\\dev-projects\\iftah.dev');
});

// ---------------------------------------------------------------------------
// sessions.ts
// ---------------------------------------------------------------------------

function fixture() {
  return mergeRows([
    rows(`${CLAUDE_DIR}/s1.jsonl`, 'code', {
      sessionId: 's1', cwd: 'E:\\dev-projects\\iftah.dev', turns: [2 * MIN, 4 * MIN, 30 * MIN],
      lines: [12, 3], prs: ['https://github.com/o/r/pull/7'], title: 'Fix the chat widget',
      corpus: ['add a chat widget', 'chat again'],
    }),
    rows('/home/me/.codex/sessions/2026/09/01/rollout-x-c1.jsonl', 'codex', {
      sessionId: '01A0BEE3-c1', raw: 'e:\\dev-projects\\iftah.dev', turns: [10 * MIN], lines: [40, 0],
      corpus: ['NLWeb chat for the site'],
    }),
    // A subagent-only shell is never listed.
    rows(`${CLAUDE_DIR}/ghost/subagents/agent-z.jsonl`, 'code', { sessionId: 'ghost', sidechain: true, corpus: ['chat'] }),
  ], []);
}

const TITLES = parseSessionIndex(
  [
    '{"id":"01a0bee3-c1","thread_name":"First name"}',
    'not json',
    '{"id":"01A0BEE3-C1","thread_name":"Add NLWeb chat","updated_at":"x"}',
    '{"id":"empty","thread_name":""}',
  ].join('\n'),
);

test('parseSessionIndex: last entry per id wins, ids lower-cased, junk skipped', () => {
  assert.equal(TITLES.get('01a0bee3-c1'), 'Add NLWeb chat');
  assert.equal(TITLES.has('empty'), false);
  assert.equal(TITLES.size, 1);
});

test('buildSessionRows: titles, active time, turns, lines, PRs — same fields on both platforms', () => {
  const m = fixture();
  const all = buildSessionRows(m.events, m.insights, [], 'all', TITLES);
  assert.deepEqual(all.map((r) => r.session_id).sort(), ['01A0BEE3-c1', 's1']);
  const s1 = all.find((r) => r.session_id === 's1')!;
  assert.equal(s1.title, 'Fix the chat widget');
  assert.equal(s1.active_ms, 36 * MIN);
  assert.equal(s1.duration_minutes, 90, 'wall clock is kept separately');
  assert.equal(s1.turn_count, 3);
  assert.equal(s1.lines_added, 12);
  assert.equal(s1.lines_removed, 3);
  assert.deepEqual(s1.pr_urls, ['https://github.com/o/r/pull/7']);
  assert.equal(s1.project_path, 'e:\\dev-projects\\iftah.dev');
  const c1 = all.find((r) => r.source === 'codex')!;
  assert.equal(c1.title, 'Add NLWeb chat', 'Codex title from session_index.jsonl');
  assert.equal(c1.project_path, s1.project_path, 'one project across platforms');

  assert.deepEqual(buildSessionRows(m.events, m.insights, [], 'codex', TITLES).map((r) => r.source), ['codex']);
  assert.deepEqual(buildSessionRows(m.events, m.insights, [], 'claude', TITLES).map((r) => r.source), ['code']);
});

test('buildSessionSummary: counts, longest active session, median turn, lines — split per platform', () => {
  const m = fixture();
  const all = buildSessionRows(m.events, m.insights, [], 'all', TITLES);
  const sum = buildSessionSummary(all, m.insights.turns);
  assert.equal(sum.total.sessions, 2);
  assert.equal(sum.claude.sessions, 1);
  assert.equal(sum.codex.sessions, 1);
  assert.equal(sum.total.longestActiveMs, 36 * MIN);
  assert.equal(sum.total.longestLabel, 'Fix the chat widget');
  assert.equal(sum.total.medianTurnMs, 7 * MIN, 'median of 2, 4, 10, 30 min');
  assert.equal(sum.claude.medianTurnMs, 4 * MIN);
  assert.equal(sum.codex.medianTurnMs, 10 * MIN);
  assert.equal(sum.total.linesAdded, 52);
  assert.equal(sum.codex.linesAdded, 40);
  assert.equal(sum.total.since, T);
  const empty = buildSessionSummary([], []);
  assert.equal(empty.total.sessions, 0);
  assert.equal(empty.total.medianTurnMs, null);
  assert.equal(empty.total.since, null);
  assert.equal(median([3, 1, 2]), 2);
});

test('searchSessions is scoped by source and lists only openable sessions', () => {
  const m = fixture();
  const hits = searchSessions(m.insights, 'chat', 0, 'all', TITLES);
  assert.deepEqual(hits.map((h) => h.sessionId).sort(), ['01A0BEE3-c1', 's1'], 'the subagent-only shell is skipped');
  assert.equal(hits[0].sessionId, 's1', 'most matches first (2 in prompts + 1 in the title)');
  assert.equal(hits[0].matches, 3);
  assert.match(hits[0].snippet, /chat widget/);
  const codexOnly = searchSessions(m.insights, 'chat', 0, 'codex', TITLES);
  assert.deepEqual(codexOnly.map((h) => h.source), ['codex']);
  assert.equal(codexOnly[0].title, 'Add NLWeb chat');
  assert.deepEqual(searchSessions(m.insights, 'NLWeb', 0, 'claude', TITLES), []);
  assert.equal(searchSessions(m.insights, 'fix the', 0, 'all', TITLES).length, 1, 'title matches count');
});

test('legacyProjectPaths maps the new path back to the folder decode old tags use', () => {
  const m = fixture();
  const legacy = legacyProjectPaths(m.insights, [{ session_id: 'x', project_path: 'E:\\dev-projects\\iftah.dev' }]);
  assert.deepEqual(
    [...(legacy.get('e:\\dev-projects\\iftah.dev') ?? [])].sort(),
    ['E:\\dev-projects\\iftah.dev', 'e:\\dev-projects-iftah-dev'],
  );
});

// ---------------------------------------------------------------------------
// transcript.ts
// ---------------------------------------------------------------------------

function feed(builder: ReturnType<typeof codexTranscriptBuilder>, lines: unknown[]) {
  lines.forEach((l, i) => builder.line(typeof l === 'string' ? l : JSON.stringify(l), i));
  return builder.finish();
}

const iso = (ms: number) => new Date(ms).toISOString();
const env = (ms: number, type: string, payload: unknown) => ({ timestamp: iso(ms), type, payload });
const item = (ms: number, turnId: string, it: unknown) =>
  env(ms, 'event_msg', { type: 'item_completed', thread_id: 't1', turn_id: turnId, item: it, completed_at_ms: ms });

test('Codex transcript: user / agent messages, tool chips, model join, compactions', () => {
  const { turns, compactions } = feed(codexTranscriptBuilder(), [
    env(T, 'session_meta', { id: 't1', cwd: 'E:\\x' }),
    // An item before its turn_context: the model is joined at the end.
    item(T + 1, 'turn-1', {
      type: 'UserMessage',
      content: [
        { type: 'text', text: '# Files mentioned by the user:\n- a.png' },
        { type: 'text', text: 'Please fix the build' },
      ],
    }),
    env(T + 2, 'turn_context', { turn_id: 'turn-1', model: 'gpt-6-astra' }),
    item(T + 3, 'turn-1', { type: 'CommandExecution', parsed_cmd: [{ type: 'unknown', cmd: 'npm run build' }], status: 'completed' }),
    item(T + 4, 'turn-1', { type: 'AgentMessage', content: [{ type: 'Text', text: 'Found it.' }], phase: 'commentary' }),
    item(T + 5, 'turn-1', { type: 'FileChange', changes: { 'E:\\x\\a.ts': { type: 'update' }, 'E:\\x\\b.ts': { type: 'add' } }, status: 'declined' }),
    item(T + 6, 'turn-1', { type: 'McpToolCall', server: 'codex_app', tool: 'load', status: 'completed' }),
    item(T + 7, 'turn-1', { type: 'Reasoning', summary_text: [] }),
    // A multi-MB history replay is counted from the header, never parsed.
    `{"timestamp":"${iso(T + 8)}","type":"compacted","payload":{"message":"<not json`,
    item(T + 9, 'turn-1', { type: 'Extension', kind: 'web.search', query: 'nlweb spec' }),
    env(T + 10, 'response_item', { type: 'message', role: 'developer' }),
  ]);
  assert.equal(compactions, 1);
  assert.equal(turns.length, 3);
  assert.deepEqual(
    turns.map((t) => [t.role, t.text]),
    [['user', 'Please fix the build'], ['assistant', ''], ['assistant', 'Found it.']],
  );
  assert.deepEqual(turns[1].tools, [{ name: 'Bash', brief: 'npm run build' }], 'tools before any reply get a tool-only turn');
  assert.deepEqual(turns[2].tools.map((t) => t.name), ['Edit', 'mcp__codex_app__load', 'WebSearch']);
  assert.equal(turns[2].tools[0].brief, 'declined · E:\\x\\a.ts (+1 more)');
  assert.equal(turns[1].model, 'gpt-6-astra');
  assert.equal(turns[0].model, undefined, 'user turns carry no model');
});

test('Claude transcript keeps this session only and skips tool_result-only user lines', () => {
  const b = claudeTranscriptBuilder('s1');
  const { turns, compactions } = feed(b, [
    { type: 'user', sessionId: 's1', timestamp: iso(T), message: { role: 'user', content: 'hello' } },
    { type: 'assistant', sessionId: 's1', timestamp: iso(T + 1), message: {
      role: 'assistant', model: 'claude-opus-5', usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3 },
      content: [{ type: 'text', text: 'hi' }, { type: 'tool_use', name: 'Read', input: { file_path: '/a.ts' } }],
    } },
    { type: 'user', sessionId: 's1', timestamp: iso(T + 2), message: { role: 'user', content: [{ type: 'tool_result', content: 'x' }] } },
    { type: 'user', sessionId: 'other', timestamp: iso(T + 3), message: { role: 'user', content: 'not mine' } },
    { type: 'summary', sessionId: 's1', timestamp: iso(T + 4) },
  ]);
  assert.equal(compactions, 1);
  assert.deepEqual(turns.map((t) => t.text), ['hello', 'hi']);
  assert.deepEqual(turns[1].tools, [{ name: 'Read', brief: '/a.ts' }]);
  assert.equal(turns[1].effectiveTokens, 6);
});

test('readTranscript splits on \\n only — a U+2028 inside a string does not break the line', async () => {
  const file = join(TMP, 'rollout-2028.jsonl');
  writeFileSync(file, [
    JSON.stringify(item(T, 'turn-1', { type: 'UserMessage', content: [{ type: 'text', text: 'line one\u2028still one' }] })),
    JSON.stringify(item(T + 1, 'turn-1', { type: 'AgentMessage', content: [{ type: 'Text', text: 'ok' }] })),
  ].join('\n'));
  const res = await readTranscript(file, 't1', 'codex');
  assert.equal(res.totalTurns, 2);
  assert.equal(res.turns[0].text, 'line one\u2028still one');
});

test('capTurns keeps the first 50 and the last 250 of a long session', () => {
  const many: TranscriptTurn[] = Array.from({ length: 400 }, (_, i) => ({ role: 'user', ts: i, text: String(i), tools: [] }));
  const { turns, truncated } = capTurns(many);
  assert.equal(truncated, true);
  assert.equal(turns.length, 300);
  assert.equal(turns[49].text, '49');
  assert.equal(turns[50].text, '150');
  assert.equal(capTurns(many.slice(0, 10)).truncated, false);
});
