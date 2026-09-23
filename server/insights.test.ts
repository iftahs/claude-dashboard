import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBranches, buildComplexity, buildErrors, buildFileChurn, buildInsightsSummary, buildMcp,
  buildRejections, buildRetries, buildSubagentStats, buildTurnLatency, buildYield, classifyError,
  hasRepo, knownProjectRoots, repoNameFromUrl, worktreeRepo,
} from './insights.ts';
import { buildCommandUsage, parseSlashHistory } from './history.ts';
import { GUARDIAN_DENY_TOOL } from './scan-pass-codex.ts';
import type {
  InsightsData, SessionMetaRecord, TaskSpawnRecord, ToolCallRecord, ToolResultRecord,
} from './insights-scan.ts';
import type { TurnRow } from './scan-pass.ts';
import type { UsageEvent, UsageSource } from './scan.ts';

// Synthetic data only — every id, path and name below is made up.
const NOW = Date.parse('2026-09-20T12:00:00.000Z');
const HOUR = 3600_000;
const T = NOW - 2 * HOUR; // inside every window below
const OLD = NOW - 40 * 24 * HOUR; // outside a 30-day window

function session(id: string, source: UsageSource, over: Partial<SessionMetaRecord> = {}): SessionMetaRecord {
  return {
    sessionId: id, isSidechain: false, firstTs: T, lastTs: T, turns: 1, assistantMsgs: 1,
    toolCallCount: 0, errorCount: 0, rejectionCount: 0, subagentSpawns: 0, compactions: 0,
    committed: false, gitCommits: 0, gitPushes: 0, firstPrompt: '', gitBranch: '',
    projectPath: '', models: {}, effectiveTokens: 100, cost: 0, file: '', source,
    linesAdded: 0, linesRemoved: 0, activeMs: 0, prUrls: [],
    ...over,
  };
}

function call(id: string, name: string, source: UsageSource, over: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return {
    ts: T, sessionId: 's', name, isSidechain: false, mcpServer: null, filePath: null,
    gitBranch: '', projectPath: '', id, source, ...over,
  };
}

function spawn(id: string, sessionId: string, type: string, source: UsageSource, ts = T): TaskSpawnRecord {
  return {
    ts, sessionId, id, subagentType: type, model: null, description: '', agentIdFromResult: null,
    completed: true, gitBranch: '', projectPath: '', source,
  };
}

function data(over: Partial<InsightsData> & { results?: ToolResultRecord[] } = {}): InsightsData {
  const { results = [], ...rest } = over;
  return {
    toolCalls: [], toolResults: new Map(results.map((r) => [r.id, r])), taskSpawns: [],
    sessionsMeta: new Map(), searchCorpus: new Map(),
    limitHits: [], rateLimitSnaps: [], lineChanges: [], prLinks: [], turns: [],
    ...rest,
  };
}

const ok = (id: string): ToolResultRecord => ({ id, is_error: false, rejected: false, errorText: '' });
const fail = (id: string, errorText = ''): ToolResultRecord => ({ id, is_error: true, rejected: false, errorText });
const reject = (id: string): ToolResultRecord => ({ id, is_error: true, rejected: true, errorText: 'declined' });

test('classifyError: text patterns first, then what the failed call was', () => {
  assert.equal(classifyError('Exit code 2 sed: cannot read x'), 'exit-code');
  assert.equal(classifyError('Exit code 143 Command timed out after 10m'), 'timeout');
  assert.equal(classifyError('<tool_use_error>String to replace not found in file.'), 'edit-mismatch');
  assert.equal(classifyError('<tool_use_error>File has been modified since read'), 'not-read');
  assert.equal(classifyError('File does not exist. Note: your current working directory is x'), 'file-not-found');
  assert.equal(classifyError("You've hit your session limit · resets 8pm"), 'usage-limit');
  assert.equal(classifyError('PreToolUse:Edit hook error: nope'), 'blocked');
  assert.equal(classifyError("Remove-Item on system path 'X:\\' is blocked."), 'blocked');
  assert.equal(classifyError('Search failed — rg: regex parse error: unclosed group'), 'invalid-input');
  assert.equal(classifyError('something odd'), 'other');

  // Codex: a failed command's text is its stderr — the exit code is implied.
  assert.equal(classifyError('Error: build failed', { name: 'Bash', source: 'codex', mcpServer: null }), 'exit-code');
  assert.equal(classifyError('', { name: 'Edit', source: 'codex', mcpServer: null }), 'patch-failed');
  assert.equal(classifyError('x is not a function', { name: 'mcp__repl__js', source: 'codex', mcpServer: 'repl' }), 'mcp-error');
  // …but a recognisable message still wins over the fallback.
  assert.equal(classifyError('Timed out after 3000ms', { name: 'mcp__b__click', source: 'codex', mcpServer: 'b' }), 'timeout');
  // A Claude Bash error without the exit-code prefix stays 'other'.
  assert.equal(classifyError('weird', { name: 'Bash', source: 'code', mcpServer: null }), 'other');
});

test('buildErrors counts rejections beside failures, never as one', () => {
  const d = data({
    toolCalls: [
      call('a', 'Bash', 'code'), call('b', 'Bash', 'code'), call('c', 'Edit', 'code'),
      call('d', 'Edit', 'code'), call('e', 'Read', 'code'),
    ],
    results: [fail('a', 'Exit code 1 boom'), ok('b'), reject('c'), fail('d', 'String to replace not found'), ok('e')],
  });
  const e = buildErrors(d, 7, NOW);
  assert.equal(e.totalCalls, 5);
  assert.equal(e.errors, 2);
  assert.equal(e.errorRate, 2 / 5);
  assert.equal(e.rejections, 1);
  assert.equal(e.rejectionRate, 1 / 5);
  assert.equal(e.categories.rejected, undefined);
  assert.deepEqual(e.categories, { 'exit-code': 1, 'edit-mismatch': 1 });
  // Only failing tools, worst first; Read never failed.
  assert.deepEqual(e.perTool.map((t) => [t.name, t.errors, t.calls]), [['Bash', 1, 2], ['Edit', 1, 2]]);
  assert.equal(e.perToolTotal, 2);
  assert.deepEqual(e.trend.map((t) => [t.calls, t.errors]), [[5, 2]]);

  // MCP errors are failures too — a declined MCP call never reached its server.
  const m = buildMcp(data({
    toolCalls: [call('m1', 'mcp__srv__x', 'code', { mcpServer: 'srv' }), call('m2', 'mcp__srv__y', 'code', { mcpServer: 'srv' })],
    results: [fail('m1', 'x'), reject('m2')],
  }), 7, NOW);
  assert.deepEqual(m.perServer, [{ server: 'srv', calls: 2, errors: 1 }]);
});

test('buildRetries measures Claude edits only and reports the Codex edits it left out', () => {
  const d = data({
    sessionsMeta: new Map([['s', session('s', 'code', { assistantMsgs: 2, effectiveTokens: 200 })]]),
    toolCalls: [
      call('e1', 'Edit', 'code', { filePath: 'a.ts' }), call('e2', 'Edit', 'code', { filePath: 'a.ts' }),
      call('x1', 'Edit', 'codex', { filePath: 'b.ts' }), call('x2', 'Write', 'codex', { filePath: 'c.ts' }),
    ],
    results: [fail('e1', 'String to replace not found'), ok('e2'), ok('x1'), ok('x2')],
  });
  const r = buildRetries(d, 7, NOW);
  assert.equal(r.totalEdits, 2);
  assert.equal(r.retried, 1);
  assert.equal(r.oneShotRate, 0.5);
  assert.equal(r.codexEdits, 2);

  const codexOnly = buildRetries(data({ toolCalls: [call('x1', 'Edit', 'codex')], results: [ok('x1')] }), 7, NOW);
  assert.equal(codexOnly.totalEdits, 0);
  assert.equal(codexOnly.codexEdits, 1);
});

test('hasRepo: a branch, a remote or any git activity — not the cwd', () => {
  assert.equal(hasRepo(session('a', 'code')), false);
  assert.equal(hasRepo(session('a', 'code', { gitBranch: 'main' })), true);
  assert.equal(hasRepo(session('a', 'codex', { repoUrl: 'https://example.com/o/r.git' })), true);
  // A Codex chat that started in a scratch folder and committed elsewhere still counts.
  assert.equal(hasRepo(session('a', 'codex', { committed: true, gitCommits: 3 })), true);
  assert.equal(hasRepo(session('a', 'codex', { prUrls: ['https://example.com/o/r/pull/1'] })), true);
});

test('buildYield: commit rate over repo sessions, no-repo sessions apart, PR funnel stage', () => {
  const d = data({
    sessionsMeta: new Map([
      ['c1', session('c1', 'code', { gitBranch: 'main', committed: true, gitCommits: 1, prUrls: ['u1', 'u2'], effectiveTokens: 500 })],
      ['c2', session('c2', 'code', { gitBranch: 'feat', effectiveTokens: 300, projectPath: 'e:\\work\\app' })],
      ['c3', session('c3', 'codex', { committed: true, gitCommits: 2, effectiveTokens: 400 })],
      ['n1', session('n1', 'codex', { effectiveTokens: 900, projectPath: 'c:\\scratch\\new-chat' })],
      ['old', session('old', 'code', { gitBranch: 'main', firstTs: OLD, lastTs: OLD })],
      ['side', session('side', 'code', { gitBranch: 'main', isSidechain: true })],
    ]),
  });
  const y = buildYield(d, 30, NOW);
  assert.equal(y.sessions, 4);
  assert.equal(y.repoSessions, 3);
  assert.equal(y.noRepo, 1);
  assert.equal(y.tokensNoRepo, 900);
  assert.equal(y.committed, 2);
  assert.equal(y.uncommitted, 1);
  assert.equal(y.rate, 2 / 3);
  assert.equal(y.prSessions, 1);
  assert.equal(y.prCount, 2);
  // The scratch chat is never "top uncommitted" — it could not commit.
  assert.deepEqual(y.topUncommitted.map((t) => t.project), ['app']);
});

test('buildRejections splits guardian denials from declines a person made', () => {
  const d = data({
    toolCalls: [
      call('g1', GUARDIAN_DENY_TOOL, 'codex'), call('d1', 'Edit', 'codex'), call('d2', 'Bash', 'code'),
      call('ok', 'Bash', 'code'),
    ],
    results: [
      { id: 'g1', is_error: false, rejected: true, errorText: '' },
      { id: 'd1', is_error: false, rejected: true, errorText: '' },
      reject('d2'), ok('ok'),
    ],
  });
  const r = buildRejections(d, 7, NOW);
  assert.equal(r.total, 3);
  assert.equal(r.guardianDenials, 1);
  assert.equal(r.userDeclines, 2);
  assert.deepEqual(r.perTool.find((t) => t.name === 'Bash'), { name: 'Bash', calls: 2, rejections: 1 });
});

test('buildSubagentStats separates delegated work from guardian auto-reviews', () => {
  const d = data({
    sessionsMeta: new Map([
      ['c1', session('c1', 'code', { subagentSpawns: 2 })],
      ['c2', session('c2', 'code')],
      ['x1', session('x1', 'codex', { subagentSpawns: 3 })],
      ['x2', session('x2', 'codex')],
    ]),
    taskSpawns: [
      spawn('t1', 'c1', 'Explore', 'code'), spawn('t2', 'c1', 'Plan', 'code'),
      spawn('r1', 'x1', 'guardian_review', 'codex'), spawn('r2', 'x1', 'guardian_review', 'codex'),
      spawn('v1', 'x1', 'review', 'codex'),
      spawn('late', 'c2', 'Explore', 'code', OLD),
    ],
    toolCalls: [call('r2', GUARDIAN_DENY_TOOL, 'codex', { sessionId: 'x1' })],
    results: [{ id: 'r2', is_error: false, rejected: true, errorText: '' }],
  });
  const s = buildSubagentStats(d, 30, NOW);
  assert.equal(s.spawns, 5);
  assert.equal(s.delegationRate, 2 / 4, 'the blended legacy rate: any spawn');
  assert.deepEqual(s.delegation, { spawns: 3, sessions: 2, rate: 2 / 4, avgPerSession: 1.5 });
  assert.deepEqual(s.autoReview, { reviews: 2, denials: 1, sessions: 1, rate: 1 / 2, avgPerSession: 2 });

  // No Codex thread in scope: the auto-review rate does not apply.
  const claudeOnly = buildSubagentStats(data({ sessionsMeta: new Map([['c', session('c', 'code')]]) }), 30, NOW);
  assert.equal(claudeOnly.autoReview.rate, null);
});

test('buildTurnLatency: nearest-rank median / p90, TTFT only where recorded, per-platform histogram', () => {
  const turn = (key: string, source: UsageSource, durationMs: number, ttftMs: number | null, ts = T): TurnRow =>
    ({ key, ts, sessionId: 's', source, durationMs, ttftMs });
  const d = data({
    turns: [
      turn('a', 'code', 5_000, 1_000), turn('b', 'code', 20_000, 2_000), turn('c', 'code', 90_000, 3_000),
      turn('d', 'codex', 400_000, null), turn('e', 'codex', 4_000_000, 5_000),
      turn('old', 'code', 1, 1, OLD),
    ],
  });
  const t = buildTurnLatency(d, 30, NOW);
  assert.equal(t.turns, 5);
  assert.equal(t.medianMs, 90_000);
  assert.equal(t.p90Ms, 4_000_000);
  assert.equal(t.medianTtftMs, 2_000); // four recorded TTFTs, nearest rank
  assert.equal(t.activeMs, 5_000 + 20_000 + 90_000 + 400_000 + 4_000_000);
  assert.equal(t.byPlatform.claude?.turns, 3);
  assert.equal(t.byPlatform.claude?.medianMs, 20_000);
  assert.equal(t.byPlatform.codex?.medianTtftMs, 5_000);
  const row = (label: string) => t.histogram.find((h) => h.label === label);
  assert.deepEqual([row('<10s')?.claude, row('10–30s')?.claude, row('1–2m')?.claude], [1, 1, 1]);
  assert.deepEqual([row('5–10m')?.codex, row('30m+')?.codex, row('30m+')?.total], [1, 1, 1]);
  assert.equal(t.histogram.reduce((s, h) => s + h.total, 0), 5);

  const none = buildTurnLatency(data(), 7, NOW);
  assert.deepEqual([none.turns, none.medianMs, none.byPlatform.claude, none.byPlatform.codex], [0, null, null, null]);
});

test('buildInsightsSummary: one KPI row overall and per platform', () => {
  const d = data({
    sessionsMeta: new Map([
      ['c1', session('c1', 'code', { gitBranch: 'main', committed: true, gitCommits: 1, subagentSpawns: 1 })],
      ['c2', session('c2', 'code', { gitBranch: 'main' })],
      ['x1', session('x1', 'codex', { subagentSpawns: 1 })],
    ]),
    taskSpawns: [spawn('t1', 'c1', 'Explore', 'code'), spawn('r1', 'x1', 'guardian_review', 'codex')],
    toolCalls: [
      call('a', 'Bash', 'code', { sessionId: 'c1' }), call('b', 'Bash', 'code', { sessionId: 'c1' }),
      call('c', 'Bash', 'codex', { sessionId: 'x1' }), call('d', 'Edit', 'codex', { sessionId: 'x1' }),
    ],
    results: [fail('a', 'Exit code 1'), ok('b'), reject('c'), ok('d')],
  });
  const s = buildInsightsSummary(d, 7, NOW);
  assert.equal(s.totalCalls, 4);
  assert.equal(s.failures, 1);
  assert.equal(s.failureRate, 1 / 4);
  assert.equal(s.rejections, 1);
  assert.equal(s.commitRate, 1 / 2);
  assert.equal(s.delegationRate, 1 / 3);
  assert.equal(s.autoReviewRate, 1);

  assert.equal(s.byPlatform.claude?.failureRate, 1 / 2);
  assert.equal(s.byPlatform.claude?.rejectionRate, 0);
  assert.equal(s.byPlatform.claude?.autoReviewRate, null);
  assert.equal(s.byPlatform.codex?.rejectionRate, 1 / 2);
  assert.equal(s.byPlatform.codex?.commitRate, null, 'no Codex thread could commit');
  assert.equal(s.byPlatform.codex?.delegationRate, 0);

  const codexOnly = buildInsightsSummary(data({ sessionsMeta: new Map([['x', session('x', 'codex')]]) }), 7, NOW);
  assert.equal(codexOnly.byPlatform.claude, null);
  assert.ok(codexOnly.byPlatform.codex);
});

test('buildBranches names the repo from the remote when the log has one', () => {
  assert.equal(worktreeRepo('E:\\work\\web\\.claude\\worktrees\\brave-otter-1a2b'), 'web');
  assert.equal(worktreeRepo('/home/u/web/.claude/worktrees/x/src/a.ts'), 'web');
  assert.equal(worktreeRepo('E:\\work\\web\\src'), null);
  assert.equal(repoNameFromUrl('https://example.com/acme/web.git'), 'web');
  assert.equal(repoNameFromUrl('git@example.com:acme/api.git'), 'api');
  assert.equal(repoNameFromUrl('https://example.com/acme/site/'), 'site');
  const d = data({
    sessionsMeta: new Map([
      ['x', session('x', 'codex', { gitBranch: 'main', repoUrl: 'https://example.com/acme/web.git', projectPath: 'c:\\scratch\\chat-1' })],
      ['c', session('c', 'code', { gitBranch: 'main', projectPath: 'e:\\lossy-decoded', cwd: 'E:\\work\\web' })],
      ['w', session('w', 'code', { gitBranch: 'feat', cwd: 'E:\\work\\web\\.claude\\worktrees\\brave-otter-1a2b' })],
    ]),
  });
  const b = buildBranches(d, 7, NOW);
  assert.deepEqual(b.map((r) => [r.repo, r.branch, r.sessions]), [['web', 'main', 2], ['web', 'feat', 1]]);
});

test('buildComplexity tags each session with its platform', () => {
  const d = data({
    sessionsMeta: new Map([
      ['c', session('c', 'cowork', { effectiveTokens: 10 })],
      ['x', session('x', 'codex', { effectiveTokens: 20, subagentSpawns: 4 })],
    ]),
  });
  assert.deepEqual(buildComplexity(d, 7, NOW).map((p) => [p.sessionId, p.platform, p.subagents]), [['x', 'codex', 4], ['c', 'claude', 0]]);
});

test('buildFileChurn labels a file by the deepest known folder that holds it', () => {
  const d = data({
    sessionsMeta: new Map([
      ['c', session('c', 'code', { cwd: 'E:\\work\\site', projectPath: 'e:\\work-site' })],
      ['c2', session('c2', 'code', { cwd: 'E:\\work\\api' })],
      ['c3', session('c3', 'code', { cwd: 'E:\\work' })], // a folder of projects, not a project
      ['x', session('x', 'codex', { projectPath: 'c:\\scratch\\chat-1' })],
    ]),
    toolCalls: [
      call('1', 'Edit', 'codex', { filePath: 'E:\\work\\site\\app\\layout.tsx', projectPath: 'c:\\scratch\\chat-1' }),
      call('2', 'Edit', 'codex', { filePath: 'c:\\scratch\\chat-1\\notes.md', projectPath: 'c:\\scratch\\chat-1' }),
      call('3', 'Write', 'codex', { filePath: 'D:\\elsewhere\\x.txt', projectPath: 'c:\\scratch\\chat-1' }),
      call('4', 'Edit', 'codex', { filePath: 'E:\\work\\site-copy\\lib\\env.ts', projectPath: 'c:\\scratch\\chat-1' }),
      call('5', 'Edit', 'code', { filePath: 'E:\\work\\README.md', projectPath: 'e:\\work' }),
      call('6', 'Edit', 'code', { filePath: 'E:\\work\\site\\.claude\\worktrees\\wt-1\\app\\page.tsx', projectPath: 'e:\\lossy' }),
    ],
  });
  assert.deepEqual(
    knownProjectRoots(d).sort(),
    ['E:\\work\\site', 'e:\\work-site', 'E:\\work\\api', 'E:\\work', 'c:\\scratch\\chat-1'].sort(),
  );
  const scoped = { ...d, sessionsMeta: new Map([...d.sessionsMeta].filter(([id]) => id === 'x')) };
  const churn = buildFileChurn(scoped, 7, NOW, 25, knownProjectRoots(d));
  const byName = Object.fromEntries(churn.files.map((f) => [f.name, f.projectName]));
  assert.deepEqual(byName, {
    'layout.tsx': 'site',
    'notes.md': 'chat-1',
    'x.txt': '',
    'env.ts': 'site-copy', // under the container: the folder right below it
    'README.md': 'work', // directly in the container: the container itself
    'page.tsx': 'site', // a Claude Code worktree belongs to its repository
  });
});

function event(over: Partial<UsageEvent>): UsageEvent {
  return {
    ts: T, sessionId: 's', model: 'm', inputTokens: 1, outputTokens: 1, cacheCreateTokens: 0, cacheReadTokens: 0,
    tools: [], isSidechain: false, rootSessionId: 's', attributionAgent: '', attributionSkill: '',
    attributionMcpServer: '', attributionPlugin: '', projectPath: '', gitBranch: '', source: 'code', ...over,
  };
}

test('parseSlashHistory splits on \\n only, so a U+2028 inside a prompt keeps its record whole', () => {
  const lines = [
    JSON.stringify({ display: '/model', timestamp: T, sessionId: 'a' }),
    JSON.stringify({ display: 'plain prompt\u2028/not-a-command', timestamp: T, sessionId: 'a' }),
    JSON.stringify({ display: '/review\u2028extra', timestamp: new Date(T).toISOString(), sessionId: 'b' }),
    '{broken',
  ];
  assert.deepEqual(
    parseSlashHistory(lines.join('\n')).map((e) => [e.command, e.sessionId]),
    [['/model', 'a'], ['/review', 'b']],
  );
});

test('buildCommandUsage: slash commands by surface, skills once per session, nothing for Codex', () => {
  const slash = [
    { ts: T, command: '/model', sessionId: 'code-1' },
    { ts: T, command: '/model', sessionId: 'unknown' }, // no usage left → the CLI's own surface
    { ts: T, command: '/compact', sessionId: 'cowork-1' },
    { ts: OLD, command: '/old', sessionId: 'code-1' },
  ];
  const events = [
    event({ sessionId: 'code-1', rootSessionId: 'code-1', attributionSkill: 'grill-me' }),
    event({ sessionId: 'code-1', rootSessionId: 'code-1', attributionSkill: 'grill-me' }), // same run
    event({ sessionId: 'code-2', rootSessionId: 'code-2', attributionSkill: 'grill-me' }),
    event({ sessionId: 'cowork-1', rootSessionId: 'cowork-1', source: 'cowork', attributionSkill: 'design' }),
    event({ sessionId: 'x', rootSessionId: 'x', source: 'codex' }),
  ];
  const all = buildCommandUsage({ slash, events, source: 'all', days: 30, now: NOW });
  assert.deepEqual(
    all.commands.map((c) => [c.command, c.count, c.kind]),
    [['/model', 2, 'slash'], ['grill-me', 2, 'skill'], ['/compact', 1, 'slash'], ['design', 1, 'skill']],
  );
  assert.deepEqual([all.slashCommands, all.skillSessions, all.totalCommands, all.uniqueCommands], [3, 3, 6, 4]);

  const code = buildCommandUsage({ slash, events, source: 'code', days: 30, now: NOW });
  assert.deepEqual(code.commands.map((c) => c.command), ['/model', 'grill-me']);

  const codex = buildCommandUsage({ slash, events, source: 'codex', days: 30, now: NOW });
  assert.deepEqual([codex.totalCommands, codex.commands.length], [0, 0]);
});
