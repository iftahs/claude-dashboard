import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FileRows, SessionPartialRow, UsageRow } from './scan-pass.ts';
import { mergeRows } from './merge.ts';
import { buildSessionRows } from './sessions.ts';
import { buildSessionUsage } from './session-usage.ts';

// Synthetic fixtures only — never real transcripts.
const T = Date.UTC(2026, 8, 1, 10, 0, 0);
const MIN = 60_000;
const DIR = '/home/me/.claude/projects/E--dev-projects-my-app';

function usage(sessionId: string, key: string, extra: Partial<UsageRow> = {}): UsageRow {
  return {
    dedupKey: key, ts: T, sessionId, model: 'claude-opus-5-5',
    inputTokens: 0, outputTokens: 0, cacheCreateTokens: 0, cacheReadTokens: 0,
    tools: [], isSidechain: false, rootSessionId: sessionId,
    attributionAgent: '', attributionSkill: '', attributionMcpServer: '', attributionPlugin: '',
    projectPathRaw: '', gitBranch: '', source: 'code',
    ...extra,
  };
}

function partial(sessionId: string, file: string, extra: Partial<SessionPartialRow> = {}): SessionPartialRow {
  return {
    sessionId, fileIsSidechain: false, firstTs: T, lastTs: T + 90 * MIN,
    turns: 2, compactions: 0, errorCount: 0, rejectionCount: 0, firstPrompt: 'hi', gitBranch: 'main',
    projectPath: '', file, agentId: null, source: 'code',
    assistantKeys: [`${sessionId}:m1`], gitCommitIds: [], gitPushIds: [], nonErrorResultIds: [],
    cwd: 'E:\\dev-projects\\my-app',
    ...extra,
  };
}

function file(path: string, sessions: SessionPartialRow[], rows: UsageRow[], extra: Partial<FileRows> = {}): FileRows {
  return {
    path, source: 'code', mtimeMs: T, size: 100, insightsSkipped: false,
    usage: rows, toolCalls: [], toolResults: [], taskSpawns: [], sessions, corpus: [],
    ...extra,
  };
}

function fixture() {
  return mergeRows([
    file(`${DIR}/s1.jsonl`, [partial('s1', `${DIR}/s1.jsonl`)], [
      usage('s1', 'k1', {
        inputTokens: 1_000_000, cacheReadTokens: 2_000_000, cacheCreateTokens: 1_000_000, cacheWrite1hTokens: 1_000_000,
        attributionSkill: 'deploy',
      }),
      usage('s1', 'k2', { outputTokens: 1_000_000, webSearchRequests: 2, attributionMcpServer: 'chrome', attributionSkill: 'deploy' }),
      usage('s1', 'k3', { model: 'claude-sonnet-5-5', inputTokens: 1_000_000 }),
      usage('s1', 'k4', { model: '<synthetic>' }),
      usage('s1', 'k5', { model: 'claude-haiku-5-5' }),
    ], { turns: [{ key: 't1', ts: T, sessionId: 's1', source: 'code', durationMs: 5 * MIN, ttftMs: null }],
      lineChanges: [{ key: 'l1', ts: T, sessionId: 's1', source: 'code', filePath: null, added: 10, removed: 4 }],
      titles: [{ sessionId: 's1', title: 'Ship the thing', kind: 'custom', seq: 1 }] }),
    // A subagent file: its requests name the parent through rootSessionId.
    file(`${DIR}/s1/subagents/agent-a.jsonl`, [partial('s1', `${DIR}/s1/subagents/agent-a.jsonl`, { fileIsSidechain: true })], [
      usage('s1', 'k6', { outputTokens: 1_000_000, isSidechain: true, attributionAgent: 'reviewer' }),
    ]),
    file(`${DIR}/other.jsonl`, [partial('other', `${DIR}/other.jsonl`)], [usage('other', 'k7', { inputTokens: 5_000_000 })]),
  ], []);
}

test('buildSessionUsage: cost by model, sorted, with 1h writes and web searches priced', () => {
  const m = fixture();
  const u = buildSessionUsage('s1', m.events, m.insights, new Map())!;
  // Opus 5.5 (4/20): 1M input 4 + 1M 1h write 8 + 2M reads 0.4 + 1M output 20 + 2 searches 0.02 + subagent 1M output 20.
  const opus = u.models.find((x) => x.model === 'claude-opus-5-5')!;
  assert.equal(Math.round(opus.cost * 1e6) / 1e6, 4 + 8 + 0.4 + 20 + 0.02 + 20);
  assert.deepEqual(
    [opus.inputTokens, opus.outputTokens, opus.cacheReadTokens, opus.cacheWriteTokens, opus.cacheWrite1hTokens],
    [1_000_000, 2_000_000, 2_000_000, 1_000_000, 1_000_000],
  );
  assert.deepEqual(u.models.map((x) => x.model), ['claude-opus-5-5', 'claude-sonnet-5-5'], 'synthetic and zero-token models are left out, cost order');
  assert.equal(Math.round(u.totalCost * 1e6) / 1e6, Math.round((opus.cost + 2) * 1e6) / 1e6);
  assert.equal(Math.round(u.models.reduce((s, x) => s + x.share, 0) * 1e9) / 1e9, 1);
  assert.equal(u.webSearches, 2);
});

test('buildSessionUsage: header fields, cache hit rate, partial flag', () => {
  const m = fixture();
  const u = buildSessionUsage('s1', m.events, m.insights, new Map())!;
  assert.deepEqual(
    [u.sessionId, u.source, u.title, u.projectName, u.firstTs, u.lastTs, u.activeMs, u.linesAdded, u.linesRemoved, u.partial],
    ['s1', 'code', 'Ship the thing', 'my-app', T, T + 90 * MIN, 5 * MIN, 10, 4, false],
  );
  // reads 2M / (input 2M + 2M reads + 1M writes)
  assert.equal(u.cacheHitRate, 2 / 5);
  assert.equal(u.projectName.includes('\\'), false, 'only the last path segment');
});

test('buildSessionUsage: contributors are cost-weighted shares of the whole session, subagents included', () => {
  const m = fixture();
  const u = buildSessionUsage('s1', m.events, m.insights, new Map())!;
  const cost = u.totalCost;
  const share = (kind: string, name: string) => u.contributors.find((c) => c.kind === kind && c.name === name)?.share;
  // deploy: k1 (12.4) + k2 (20.02); chrome: k2 (20.02); reviewer: k6 (20).
  assert.ok(Math.abs(share('skill', 'deploy')! - (12.4 + 20.02) / cost) < 1e-9);
  assert.ok(Math.abs(share('mcp', 'chrome')! - 20.02 / cost) < 1e-9);
  assert.ok(Math.abs(share('subagent', 'reviewer')! - 20 / cost) < 1e-9);
  assert.equal(share('plugin', 'x'), undefined);
  assert.deepEqual(u.contributors.map((c) => c.share), [...u.contributors.map((c) => c.share)].sort((a, b) => b - a));
});

test('buildSessionUsage: Codex sessions weigh contributors by effective tokens, not the $0 guardian cost', () => {
  const rows = (sessionId: string, model: string, extra: Partial<UsageRow>) =>
    usage(sessionId, `${model}:${extra.outputTokens}`, { source: 'codex', model, ...extra });
  const m = mergeRows([
    file('/home/me/.codex/sessions/rollout-x.jsonl', [partial('c1', '/home/me/.codex/sessions/rollout-x.jsonl', { source: 'codex' })], [
      rows('c1', 'gpt-6-sol', { inputTokens: 300, attributionSkill: 'plan' }),
      rows('c1', 'codex-auto-review', { outputTokens: 100, attributionAgent: 'guardian' }),
    ], { source: 'codex' }),
  ], []);
  const u = buildSessionUsage('c1', m.events, m.insights, new Map())!;
  assert.equal(u.contributors.find((c) => c.name === 'guardian')!.share, 100 / 400);
  assert.equal(u.contributors.find((c) => c.name === 'plan')!.share, 300 / 400);
  assert.equal(u.models.find((x) => x.model === 'codex-auto-review')!.share, 0, 'priced at zero');
});

test('buildSessionUsage: an unknown id is null, and a session with no turns has no active time', () => {
  const m = fixture();
  assert.equal(buildSessionUsage('nope', m.events, m.insights, new Map()), null);
  assert.equal(buildSessionUsage('__proto__', m.events, m.insights, new Map()), null);
  assert.equal(buildSessionUsage('other', m.events, m.insights, new Map())!.activeMs, null);
});

test('an oversized main transcript is a listed, partial session whose tokens and cost still come from events', () => {
  const huge = file(`${DIR}/big.jsonl`, [partial('big', `${DIR}/big.jsonl`, { oversized: true, turns: 0, firstPrompt: '' })], [
    usage('big', 'b1', { inputTokens: 1_000_000, outputTokens: 1_000_000 }),
  ], { insightsSkipped: true, size: 200 * 1024 * 1024 });
  const sub = file(`${DIR}/big/subagents/agent-z.jsonl`, [partial('big', `${DIR}/big/subagents/agent-z.jsonl`, { fileIsSidechain: true })], [
    usage('big', 'b2', { outputTokens: 1_000_000, isSidechain: true, rootSessionId: 'big' }),
  ]);
  const m = mergeRows([huge, sub], []);

  const sm = m.insights.sessionsMeta.get('big')!;
  assert.deepEqual([sm.isSidechain, sm.partial], [false, true]);
  const [row] = buildSessionRows(m.events, m.insights, [], 'all', new Map());
  assert.deepEqual(
    [row.session_id, row.partial, row.input_tokens, row.output_tokens, row.last_ts],
    ['big', true, 1_000_000, 2_000_000, T + 90 * MIN],
  );
  assert.equal(Math.round(row.cost * 1e6) / 1e6, 4 + 20 + 20);
  const u = buildSessionUsage('big', m.events, m.insights, new Map())!;
  assert.equal(u.partial, true);
  assert.equal(u.totalCost, row.cost);
});

test('buildSessionRows: cost and last_ts on every row, matching the source filter', () => {
  const m = fixture();
  const all = buildSessionRows(m.events, m.insights, [], 'all', new Map());
  const s1 = all.find((r) => r.session_id === 's1')!;
  assert.equal(s1.partial, undefined);
  assert.equal(s1.last_ts, T + 90 * MIN);
  assert.equal(Math.round(s1.cost * 1e6) / 1e6, Math.round(buildSessionUsage('s1', m.events, m.insights, new Map())!.totalCost * 1e6) / 1e6);
  assert.deepEqual(buildSessionRows(m.events, m.insights, [], 'codex', new Map()), []);
  const legacy = buildSessionRows([], m.insights, [{ session_id: 'old', start_time: new Date(T).toISOString(), duration_minutes: 30 }], 'all', new Map())
    .find((r) => r.session_id === 'old')!;
  assert.deepEqual([legacy.cost, legacy.last_ts], [0, T + 30 * MIN]);
});
