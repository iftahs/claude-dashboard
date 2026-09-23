import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FileRows, ScannedFile, SessionPartialRow, UsageRow } from './scan-pass.ts';
import type { ScanRoot, UsageSource } from './scan.ts';
import {
  archiveRows, archiveStats, closeStore, loadArchive, loadRows, persistRows, slimRows, storeReady,
  type ArchivedFile,
} from './event-store.ts';
import {
  archiveSig, archiveSources, classifyGone, archiveSummary, canReuseMerge, forgetArchivedHistory,
  getEvents, getInsights, invalidateData, orderForMerge,
} from './data.ts';
import { mergeRows } from './merge.ts';

// Everything this file touches lives under one temp dir — never the real
// ~/.claude, Cowork root, ~/.codex or dashboard cache.
const TMP = mkdtempSync(join(tmpdir(), 'dash-archive-'));
process.env.DASHBOARD_RETAIN_HISTORY = '1';
process.env.CLAUDE_DIR = join(TMP, 'claude');
process.env.COWORK_DIR = join(TMP, 'cowork');
process.env.CODEX_DIR = join(TMP, 'codex');
process.env.DASHBOARD_CACHE_DIR = join(TMP, 'cache-a');

after(() => {
  closeStore();
  try {
    rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* Windows can hold the db a moment longer; the OS temp cleaner gets it */
  }
});

const T = Date.UTC(2026, 6, 1, 12, 0, 0);

function usage(sessionId: string, key: string, ts: number, source: UsageSource = 'code'): UsageRow {
  return {
    dedupKey: key, ts, sessionId, model: 'claude-sonnet-4-6',
    inputTokens: 10, outputTokens: 20, cacheCreateTokens: 5, cacheReadTokens: 100,
    tools: ['Bash'], isSidechain: false, rootSessionId: sessionId,
    attributionAgent: '', attributionSkill: '', attributionMcpServer: '', attributionPlugin: '',
    projectPathRaw: '/proj', gitBranch: 'main', source,
  };
}

function session(sessionId: string, file: string, firstPrompt: string, ts: number, source: UsageSource = 'code'): SessionPartialRow {
  return {
    sessionId, fileIsSidechain: false, firstTs: ts, lastTs: ts + 60_000,
    turns: 3, compactions: 0, errorCount: 1, rejectionCount: 0,
    firstPrompt, gitBranch: 'main', projectPath: '/proj', file, agentId: null, source,
    assistantKeys: [`req_${file}:msg_1`], gitCommitIds: ['toolu_commit'], gitPushIds: [],
    nonErrorResultIds: ['toolu_commit'],
  };
}

function fileRows(path: string, sessionId: string, firstPrompt: string, ts: number, source: UsageSource = 'code'): FileRows {
  return {
    path, source, mtimeMs: ts, size: 1234, insightsSkipped: false,
    usage: [usage(sessionId, `req_${path}:msg_1`, ts, source)],
    toolCalls: [{
      toolId: 'toolu_read', ts, sessionId, name: 'Read', isSidechain: false, mcpServer: null,
      filePath: '/proj/secret.txt', gitBranch: 'main', projectPath: '/proj', source,
    }],
    toolResults: [
      { toolId: 'toolu_read', sessionId, isError: true, rejected: false, errorText: 'SECRET error output', agentIdFromResult: null },
      { toolId: 'toolu_commit', sessionId, isError: false, rejected: false, errorText: '', agentIdFromResult: null },
      { toolId: 'toolu_task', sessionId, isError: false, rejected: false, errorText: '', agentIdFromResult: 'a1b2' },
      { toolId: 'toolu_ls', sessionId, isError: false, rejected: false, errorText: '', agentIdFromResult: null },
    ],
    taskSpawns: [{
      toolId: 'toolu_task', ts, sessionId, subagentType: 'Explore', model: null,
      description: 'SECRET task description', gitBranch: 'main', projectPath: '/proj', source,
    }],
    sessions: [session(sessionId, path, firstPrompt, ts, source)],
    corpus: [{ sessionId, snippets: ['SECRET transcript snippet'] }],
    limitHits: [{ key: 'lh1', ts, sessionId, source, kind: 'session', model: 'claude-sonnet-4-6', resetsAt: null }],
    lineChanges: [{ key: 'toolu_edit', ts, sessionId, source, filePath: '/proj/a.ts', added: 7, removed: 2 }],
    prLinks: [{ url: 'https://github.com/o/r/pull/1', ts, sessionId, source, number: 1, repo: 'o/r' }],
    turns: [{ key: 'turn1', ts, sessionId, source, durationMs: 4000, ttftMs: null }],
    titles: [{ sessionId, title: 'A title', kind: 'ai', seq: 0 }],
  };
}

const scanned = (path: string, source: UsageSource = 'code'): ScannedFile => ({ path, source, mtimeMs: T, size: 1234 });

// ---------------------------------------------------------------------------
// slimRows
// ---------------------------------------------------------------------------

test('slimRows drops transcript and error text but keeps everything the aggregates need', () => {
  const full = fileRows('/p/a.jsonl', 's1', 'first prompt', T);
  const slim = slimRows(full);

  assert.deepEqual(slim.toolCalls, []);
  assert.deepEqual(slim.corpus, []);
  assert.equal(slim.taskSpawns[0].description, '');
  assert.equal(slim.taskSpawns[0].subagentType, 'Explore');
  assert.ok(!JSON.stringify(slim).includes('SECRET'), 'no text marker survives');

  // Only the non-error results that resolve a kept row, with no text.
  assert.deepEqual(slim.toolResults.map((r) => r.toolId).sort(), ['toolu_commit', 'toolu_task']);
  assert.ok(slim.toolResults.every((r) => r.errorText === '' && !r.isError));

  assert.deepEqual(slim.usage, full.usage);
  assert.deepEqual(slim.sessions, full.sessions, 'sessions are kept whole, first prompt included');
  for (const k of ['limitHits', 'lineChanges', 'prLinks', 'turns', 'titles'] as const) {
    assert.deepEqual(slim[k], full[k], k);
  }
  assert.deepEqual(slimRows(slim), slim, 'idempotent');
});

test('slimRows fills in arrays an older parser never wrote', () => {
  const old = fileRows('/p/old.jsonl', 's1', '', T) as any;
  for (const k of ['limitHits', 'rateLimitSnaps', 'lineChanges', 'prLinks', 'turns', 'titles']) delete old[k];
  delete old.sessions[0].gitPushIds;
  const slim = slimRows(old);
  assert.deepEqual(slim.limitHits, []);
  assert.deepEqual(slim.titles, []);
  assert.deepEqual(slim.sessions[0].gitPushIds, []);
  // …so it merges without throwing.
  assert.equal(mergeRows([slim], []).events.length, 1);
});

test('archived sessions keep their git commits and subagent completion', () => {
  const merged = mergeRows([slimRows(fileRows('/p/a.jsonl', 's1', 'hi', T))], []);
  const sm = merged.insights.sessionsMeta.get('s1')!;
  assert.equal(sm.gitCommits, 1);
  assert.equal(sm.committed, true);
  assert.equal(merged.insights.taskSpawns[0].completed, true);
  assert.equal(sm.linesAdded, 7);
});

// ---------------------------------------------------------------------------
// Merge order and source gating (pure helpers)
// ---------------------------------------------------------------------------

test('live files merge before archived ones, archived ones by archive time', () => {
  const liveRows = fileRows('/p/live.jsonl', 's1', 'live prompt', T + 1000);
  const cached = new Map([[liveRows.path, { rows: liveRows }]]);
  const archived: ArchivedFile[] = [
    { path: '/p/newer.jsonl', source: 'code', archivedAt: 200, rows: slimRows(fileRows('/p/newer.jsonl', 's2', 'newer', T)) },
    { path: '/p/older.jsonl', source: 'code', archivedAt: 100, rows: slimRows(fileRows('/p/older.jsonl', 's2', 'older', T)) },
    { path: '/p/gone.jsonl', source: 'code', archivedAt: 50, rows: slimRows(fileRows('/p/gone.jsonl', 's1', 'archived prompt', T)) },
  ];

  const ordered = orderForMerge([scanned(liveRows.path)], cached, archived, new Set(['code']));
  assert.deepEqual(ordered.map((r) => r.path), ['/p/live.jsonl', '/p/gone.jsonl', '/p/older.jsonl', '/p/newer.jsonl']);

  const sm = mergeRows(ordered, []).insights.sessionsMeta;
  assert.equal(sm.get('s1')!.firstPrompt, 'live prompt', 'first-file-wins fields come from the live file');
  assert.equal(sm.get('s1')!.file, '/p/live.jsonl');
  assert.equal(sm.get('s2')!.firstPrompt, 'older', 'the earlier archive wins among archived files');
});

test('a path that is live again never merges from the archive', () => {
  const rows = fileRows('/p/a.jsonl', 's1', 'x', T);
  const ordered = orderForMerge(
    [scanned(rows.path)],
    new Map([[rows.path, { rows }]]),
    [{ path: rows.path, source: 'code', archivedAt: 1, rows: slimRows(rows) }],
    new Set(['code']),
  );
  assert.equal(ordered.length, 1);
  assert.equal(mergeRows(ordered, []).insights.sessionsMeta.get('s1')!.turns, 3, 'not doubled');
});

const ROOTS: ScanRoot[] = [
  { dir: join('/data', '.claude', 'projects'), source: 'code' },
  { dir: join('/data', 'cowork'), source: 'cowork' },
  { dir: join('/data', '.codex', 'sessions'), source: 'codex' },
];
const codeFile = scanned(join('/data', '.claude', 'projects', 'p', 'a.jsonl'));
const codexFile = scanned(join('/data', '.codex', 'sessions', '2026', 'rollout-1.jsonl'), 'codex');
const everyDirExists = () => true;

test('archived Codex/Cowork rows join only while their root is present', () => {
  assert.deepEqual([...archiveSources(ROOTS, [codeFile], everyDirExists)], ['code'], 'Claude Code always');
  assert.deepEqual(
    [...archiveSources(ROOTS, [codeFile, codexFile], everyDirExists)].sort(),
    ['code', 'codex'],
  );
  // CODEX_DIR_HOST= opt-out: ~/.claude is mounted at the codex path and its
  // sessions/ dir exists, but it holds no rollouts.
  assert.deepEqual([...archiveSources(ROOTS, [codeFile], everyDirExists)], ['code']);
  assert.deepEqual(
    [...archiveSources(ROOTS, [codeFile, codexFile], (p) => !p.includes('.codex'))],
    ['code'],
    'root dir missing',
  );

  const codexArchived: ArchivedFile = {
    path: join('/data', '.codex', 'sessions', 'old', 'rollout-0.jsonl'), source: 'codex', archivedAt: 1,
    rows: slimRows(fileRows('/x', 'c1', '', T, 'codex')),
  };
  const hidden = orderForMerge([], new Map(), [codexArchived], archiveSources(ROOTS, [codeFile], everyDirExists));
  assert.equal(hidden.length, 0, 'opted-out Codex history stays out of the merge');
  const shown = orderForMerge([], new Map(), [codexArchived], archiveSources(ROOTS, [codexFile], everyDirExists));
  assert.equal(shown.length, 1);
});

test('a vanished file is archived only when its root still looks healthy', () => {
  const gone = { path: join('/data', '.claude', 'projects', 'p', 'old.jsonl'), source: 'code' as const };
  const action = (g: typeof gone | { path: string; source: UsageSource }, files: ScannedFile[], exists = everyDirExists) =>
    classifyGone([g], ROOTS, files, exists).get(g.path);
  assert.equal(action(gone, [codeFile]), 'archive');
  assert.equal(action(gone, []), 'wait', 'root emptied: maybe unmounted');
  assert.equal(action(gone, [codeFile], () => false), 'wait', 'root dir missing');
  assert.equal(action({ path: join('/backup', 'projects', 'p', 'old.jsonl'), source: 'code' }, [codeFile]), 'drop', 'CLAUDE_DIR moved');
  assert.equal(
    action({ path: join('/data', '.codex', 'sessions', 'r.jsonl'), source: 'codex' }, [codeFile]),
    'wait',
    'no codex files listed (opted out, or not mounted yet)',
  );
});

test('a change in the archive invalidates the merge', () => {
  const basis = { fingerprint: 1, metaSig: 2, archiveSig: archiveSig(1, 3, new Set(['code'])) };
  assert.equal(canReuseMerge(basis, { ...basis }, 0, 0), true);
  assert.equal(canReuseMerge(basis, { ...basis, archiveSig: archiveSig(2, 3, new Set(['code'])) }, 0, 0), false);
  assert.equal(canReuseMerge(basis, { ...basis, archiveSig: 0 }, 0, 0), false, 'archive forgotten');
  assert.equal(archiveSig(5, 0, new Set(['code'])), 0, 'nothing archived: no token change');
  assert.equal(canReuseMerge({ fingerprint: 1, metaSig: 2 }, { fingerprint: 1, metaSig: 2, archiveSig: 0 }, 0, 0), true);
});

// ---------------------------------------------------------------------------
// Store: the archive survives a schema bump
// ---------------------------------------------------------------------------

test('a schema bump archives vanished files and never wipes the archive', async () => {
  closeStore();
  const dir = join(TMP, 'cache-bump');
  process.env.DASHBOARD_CACHE_DIR = dir;
  const present = join(TMP, 'present.jsonl');
  writeFileSync(present, '');
  const vanished = join(TMP, 'vanished.jsonl');

  await storeReady();
  await persistRows([fileRows(present, 's1', 'here', T), fileRows(vanished, 's2', 'gone', T - 5000)]);
  assert.equal(await archiveRows([fileRows(join(TMP, 'earlier.jsonl'), 's3', 'earlier', T - 9000)], 100), true);
  closeStore();

  // Simulate the next release bumping SCHEMA_VERSION.
  const { DatabaseSync } = await import('node:sqlite');
  const raw = new DatabaseSync(join(dir, 'scan-cache.db'));
  raw.prepare("UPDATE meta SET v = '-1' WHERE k = 'schema_version'").run();
  raw.close();

  await storeReady();
  assert.equal((await loadRows()).size, 0, 'the cache itself is rebuilt');
  const archived = await loadArchive();
  assert.deepEqual(archived.map((a) => a.path), [join(TMP, 'earlier.jsonl'), vanished]);
  const moved = archived.find((a) => a.path === vanished)!;
  assert.deepEqual(moved.rows.toolCalls, [], 'archived slim');
  assert.equal(moved.rows.sessions[0].firstPrompt, 'gone');

  const stats = (await archiveStats())!;
  assert.equal(stats.files, 2);
  assert.ok(stats.bytes > 0);
  assert.equal(stats.oldestTs, T - 9000);

  // A second bump with retention off leaves the archive alone.
  closeStore();
  const raw2 = new DatabaseSync(join(dir, 'scan-cache.db'));
  raw2.prepare("UPDATE meta SET v = '-1' WHERE k = 'schema_version'").run();
  raw2.close();
  process.env.DASHBOARD_RETAIN_HISTORY = '0';
  await storeReady();
  process.env.DASHBOARD_RETAIN_HISTORY = '1';
  assert.equal((await loadArchive()).length, 2);
  closeStore();
});

// ---------------------------------------------------------------------------
// data.ts end to end over a temp CLAUDE_DIR
// ---------------------------------------------------------------------------

function transcript(sessionId: string, n: number): string {
  const ts = new Date(T + n * 60_000).toISOString();
  const lines = [
    { type: 'user', timestamp: ts, sessionId, message: { role: 'user', content: `prompt ${n}` } },
    {
      type: 'assistant', timestamp: ts, sessionId, requestId: `req_${n}`,
      message: {
        id: `msg_${n}`, role: 'assistant', model: 'claude-sonnet-4-6', content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      },
    },
  ];
  return lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
}

test('deleted transcripts keep counting until the archive is forgotten', async () => {
  closeStore();
  process.env.DASHBOARD_CACHE_DIR = join(TMP, 'cache-e2e');
  const proj = join(process.env.CLAUDE_DIR!, 'projects', 'C--demo');
  mkdirSync(proj, { recursive: true });
  const a = join(proj, 'a.jsonl');
  const b = join(proj, 'b.jsonl');
  writeFileSync(a, transcript('sa', 1));
  writeFileSync(b, transcript('sb', 2));

  const count = async () => {
    invalidateData();
    return (await getEvents()).events.length;
  };

  assert.equal(await count(), 2);

  unlinkSync(b); // Claude Code's cleanup
  assert.equal(await count(), 2, 'b is archived, not forgotten');
  assert.equal((await getInsights()).insights.sessionsMeta.get('sb')?.file, b);
  assert.equal((await archiveSummary()).files, 1);

  unlinkSync(a); // every transcript gone at once: looks like an unmounted volume
  assert.equal(await count(), 1, 'a leaves the merge but is not archived');
  assert.equal((await archiveSummary()).files, 1);

  writeFileSync(join(proj, 'c.jsonl'), transcript('sc', 3)); // the root is healthy again
  assert.equal(await count(), 3, 'a is archived now, next to b and the new c');
  assert.equal((await archiveSummary()).files, 2);

  assert.equal(await forgetArchivedHistory(), true);
  assert.equal(await count(), 1, 'only the live c is left');
  const summary = await archiveSummary();
  assert.deepEqual(summary, { enabled: true, files: 0, oldestTs: null, bytes: 0 });
});
