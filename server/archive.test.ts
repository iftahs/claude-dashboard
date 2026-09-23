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
  archiveSig, archiveSources, archivedForMerge, classifyGone, archiveSummary, canReuseMerge, forgetArchivedHistory,
  getEvents, getInsights, invalidateData, platformHome,
} from './data.ts';
import { mergeRows, reduceArchive } from './merge.ts';

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

  assert.deepEqual(slim.toolCalls, full.toolCalls, 'tool calls carry no text and feed the tool sections');
  assert.deepEqual(slim.corpus, []);
  assert.equal(slim.taskSpawns[0].description, '');
  assert.equal(slim.taskSpawns[0].subagentType, 'Explore');
  assert.ok(!JSON.stringify(slim).includes('SECRET'), 'no text marker survives');

  // Error results (failure rates) and the non-error ones that resolve a kept row, all without text.
  assert.deepEqual(
    slim.toolResults.map((r) => [r.toolId, r.isError]).sort(),
    [['toolu_commit', false], ['toolu_read', true], ['toolu_task', false]],
  );
  assert.ok(slim.toolResults.every((r) => r.errorText === ''));

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

const P_ROOTS: ScanRoot[] = [{ dir: '/p', source: 'code' }];
const CODE_ONLY = new Set<UsageSource>(['code']);

test('live files merge before archived ones, archived ones by archive time', () => {
  const liveRows = fileRows('/p/live.jsonl', 's1', 'live prompt', T + 1000);
  const archived: ArchivedFile[] = [
    { path: '/p/newer.jsonl', source: 'code', archivedAt: 200, rows: slimRows(fileRows('/p/newer.jsonl', 's2', 'newer', T)) },
    { path: '/p/older.jsonl', source: 'code', archivedAt: 100, rows: slimRows(fileRows('/p/older.jsonl', 's2', 'older', T)) },
    { path: '/p/gone.jsonl', source: 'code', archivedAt: 50, rows: slimRows(fileRows('/p/gone.jsonl', 's1', 'archived prompt', T)) },
  ];

  const inMerge = archivedForMerge([scanned(liveRows.path)], archived, CODE_ONLY, P_ROOTS);
  assert.deepEqual(inMerge.map((a) => a.path), ['/p/gone.jsonl', '/p/older.jsonl', '/p/newer.jsonl']);

  const sm = mergeRows([liveRows], [], reduceArchive(inMerge.map((a) => a.rows))).insights.sessionsMeta;
  assert.equal(sm.get('s1')!.firstPrompt, 'live prompt', 'first-file-wins fields come from the live file');
  assert.equal(sm.get('s1')!.file, '/p/live.jsonl');
  assert.equal(sm.get('s2')!.firstPrompt, 'older', 'the earlier archive wins among archived files');
});

test('an archived file live again, at its path or moved, or from another data set, never merges', () => {
  const rows = fileRows('/p/new-name/S.jsonl', 's1', 'x', T);
  const archived: ArchivedFile[] = [
    { path: rows.path, source: 'code', archivedAt: 1, rows: slimRows(rows) },
    { path: '/p/old-name/S.jsonl', source: 'code', archivedAt: 2, rows: slimRows(rows) }, // project folder renamed
    { path: '/backup/.claude/projects/x/T.jsonl', source: 'code', archivedAt: 3, rows: slimRows(fileRows('/b', 's9', 'y', T)) },
  ];
  const inMerge = archivedForMerge([scanned(rows.path)], archived, CODE_ONLY, P_ROOTS);
  assert.equal(inMerge.length, 0);
  const sm = mergeRows([rows], [], reduceArchive(inMerge.map((a) => a.rows))).insights.sessionsMeta;
  assert.equal(sm.get('s1')!.turns, 3, 'not doubled');
  assert.equal(sm.has('s9'), false, "another CLAUDE_DIR's archive stays out");
});

test('merging a reduced archive gives exactly what merging its files after the live ones gives', () => {
  const live = [fileRows('/p/l1.jsonl', 's1', 'live', T + 5000), fileRows('/p/l2.jsonl', 's3', 'live 3', T + 6000)];
  const a1 = fileRows('/p/a1.jsonl', 's1', 'archived', T);
  const a2 = fileRows('/p/a2.jsonl', 's2', 'archived 2', T + 1000);
  const a3 = { ...fileRows('/p/a3.jsonl', 's2', '', T + 2000), insightsSkipped: true };
  a1.usage.push({ ...live[0].usage[0], outputTokens: 999 }); // the archive's copy has more tokens
  a2.usage.push({ ...live[1].usage[0] }); // a tie: the live copy stays
  a2.usage.push(usage('s2', ':', T + 1000), usage('s2', ':', T + 1000)); // keyless rows are all kept
  a2.usage.push({ ...a3.usage[0] });
  a3.usage[0] = { ...a3.usage[0], inputTokens: 500 }; // bigger only in a file insights skip
  a2.toolCalls.push({ ...a2.toolCalls[0], toolId: 'toolu_arch', ts: T + 5000 }); // same ts as a live call
  a2.toolCalls.push({ ...a2.toolCalls[0], toolId: '', ts: T - 1 });
  a1.sessions[0].assistantKeys.push(live[0].sessions[0].assistantKeys[0], 'arch-only');
  const archived = [a1, a2, a3].map(slimRows);
  const metas = [{ session_id: 's1', project_path: '/real/path' }];

  const expected = mergeRows([...live, ...archived], metas);
  const reduced = reduceArchive(archived);
  assert.deepEqual(mergeRows(live, metas, reduced), expected);
  assert.deepEqual(mergeRows(live, metas, reduced), expected, 'the reduction is not consumed by a merge');
  assert.equal(expected.insights.sessionsMeta.get('s1')!.assistantMsgs, 3);
  assert.equal(expected.events.filter((e) => e.outputTokens === 999).length, 1);
});

const ROOTS: ScanRoot[] = [
  { dir: join('/data', '.claude', 'projects'), source: 'code' },
  { dir: join('/data', 'cowork'), source: 'cowork' },
  { dir: join('/data', '.codex', 'sessions'), source: 'codex' },
];
const codeFile = scanned(join('/data', '.claude', 'projects', 'p', 'a.jsonl'));
const codexFile = scanned(join('/data', '.codex', 'sessions', '2026', 'rollout-1.jsonl'), 'codex');
/** Every directory exists; no platform marker file does. */
const dirsOnly = (p: string) => !/\.(toml|json|jsonl)$/.test(p);
const noEntries = (): string[] => [];
const ACCT = '11111111-2222-3333-4444-555555555555';
const PROFILE = '66666666-7777-8888-9999-000000000000';
const coworkHome = (p: string): string[] => ({
  [join('/data', 'cowork')]: [ACCT, 'skills-plugin'],
  [join('/data', 'cowork', ACCT)]: [PROFILE],
  [join('/data', 'cowork', ACCT, PROFILE)]: ['agent', 'local_abc.json'],
}[p] ?? []);

test('platformHome recognises a Codex or Cowork install, not the ~/.claude fallback mount', () => {
  const [, cowork, codex] = ROOTS;
  assert.equal(platformHome(codex, (p) => p === join('/data', '.codex', 'auth.json'), noEntries), true);
  assert.equal(platformHome(codex, dirsOnly, noEntries), false);
  assert.equal(platformHome(cowork, dirsOnly, coworkHome), true);
  const claudeFolder = (p: string) => (p === join('/data', 'cowork') ? ['projects', 'todos', 'settings.json'] : ['x']);
  assert.equal(platformHome(cowork, dirsOnly, claudeFolder), false);
  assert.equal(platformHome(ROOTS[0], () => true, coworkHome), false, 'Claude Code has no marker');
});

test('archived Codex/Cowork rows join only while their root is present', () => {
  const sources = (files: ScannedFile[], exists = dirsOnly, list: (p: string) => string[] = noEntries) =>
    [...archiveSources(ROOTS, files, exists, list)].sort();
  assert.deepEqual(sources([codeFile]), ['code'], 'Claude Code always');
  assert.deepEqual(sources([codeFile, codexFile]), ['code', 'codex']);
  // CODEX_DIR_HOST= opt-out: ~/.claude is mounted at the codex path and its
  // sessions/ dir exists, but it holds no rollouts and no Codex home files.
  assert.deepEqual(sources([codeFile]), ['code']);
  assert.deepEqual(sources([codeFile, codexFile], (p) => dirsOnly(p) && !p.includes('.codex')), ['code'], 'root dir missing');
  // Every rollout archived or deleted: the Codex home is still there.
  assert.deepEqual(sources([codeFile], (p) => dirsOnly(p) || p.endsWith('config.toml')), ['code', 'codex']);
  // Every Cowork session deleted: its account metadata is still there.
  assert.deepEqual(sources([codeFile], dirsOnly, coworkHome), ['code', 'cowork']);

  const codexArchived: ArchivedFile = {
    path: join('/data', '.codex', 'sessions', 'old', 'rollout-0.jsonl'), source: 'codex', archivedAt: 1,
    rows: slimRows(fileRows('/x', 'c1', '', T, 'codex')),
  };
  const merged = (allowed: Set<UsageSource>) => archivedForMerge([], [codexArchived], allowed, ROOTS).length;
  assert.equal(merged(archiveSources(ROOTS, [codeFile], dirsOnly, noEntries)), 0, 'opted-out Codex history stays out');
  assert.equal(merged(archiveSources(ROOTS, [codexFile], dirsOnly, noEntries)), 1);
});

test('a vanished file is archived only when its root still looks healthy', () => {
  const gone = { path: join('/data', '.claude', 'projects', 'p', 'old.jsonl'), source: 'code' as const };
  const rollout = { path: join('/data', '.codex', 'sessions', 'rollout-9.jsonl'), source: 'codex' as const };
  const action = (g: { path: string; source: UsageSource }, files: ScannedFile[], exists = dirsOnly) =>
    classifyGone([g], ROOTS, files, exists, noEntries).get(g.path);
  assert.equal(action(gone, [codeFile]), 'archive');
  assert.equal(action(gone, []), 'wait', 'root emptied: maybe unmounted');
  assert.equal(action(gone, [codeFile], () => false), 'wait', 'root dir missing');
  assert.equal(action({ path: join('/backup', 'projects', 'p', 'old.jsonl'), source: 'code' }, [codeFile]), 'drop', 'CLAUDE_DIR moved');
  assert.equal(action(rollout, [codeFile]), 'wait', 'no codex files listed (opted out, or not mounted yet)');
  assert.equal(
    action(rollout, [codeFile], (p) => dirsOnly(p) || p.endsWith('session_index.jsonl')),
    'archive',
    'the last rollout of a real Codex home',
  );
  const renamed = scanned(join('/data', '.claude', 'projects', 'renamed', 'old.jsonl'));
  assert.equal(action(gone, [codeFile, renamed]), 'drop', 'moved, not deleted');
});

test('a change in the archive invalidates the merge', () => {
  const sig = (gen: number, n: number, roots = ROOTS) => archiveSig(gen, n, CODE_ONLY, roots);
  const basis = { fingerprint: 1, metaSig: 2, archiveSig: sig(1, 3) };
  assert.equal(canReuseMerge(basis, { ...basis }, 0, 0), true);
  assert.equal(canReuseMerge(basis, { ...basis, archiveSig: sig(2, 3) }, 0, 0), false);
  assert.equal(canReuseMerge(basis, { ...basis, archiveSig: sig(1, 3, P_ROOTS) }, 0, 0), false, 'roots changed');
  assert.equal(canReuseMerge(basis, { ...basis, archiveSig: 0 }, 0, 0), false, 'archive forgotten');
  assert.equal(sig(5, 0), 0, 'nothing archived: no token change');
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
  const vanished = join(process.env.CLAUDE_DIR!, 'projects', 'C--demo', 'vanished.jsonl');
  // Parsed once from another CLAUDE_DIR: not this data set, so not archived.
  const foreign = join(TMP, 'other-claude', 'projects', 'x', 'foreign.jsonl');

  await storeReady();
  await persistRows([
    fileRows(present, 's1', 'here', T),
    fileRows(vanished, 's2', 'gone', T - 5000),
    fileRows(foreign, 's4', 'elsewhere', T - 20_000),
  ]);
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
  assert.deepEqual(moved.rows.corpus, [], 'archived slim');
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

test('archive stats come from stored columns, backfilled for rows archived without them', async () => {
  closeStore();
  const dir = join(TMP, 'cache-stats');
  process.env.DASHBOARD_CACHE_DIR = dir;
  await storeReady();
  assert.equal(await archiveRows([fileRows(join(TMP, 'one.jsonl'), 's1', 'a', T - 1000)], 1), true);
  closeStore();

  // A row written by the release before the columns existed.
  const { DatabaseSync } = await import('node:sqlite');
  const raw = new DatabaseSync(join(dir, 'scan-cache.db'));
  const oldRows = JSON.stringify(slimRows(fileRows(join(TMP, 'two.jsonl'), 's2', 'b', T - 50_000)));
  raw.prepare('INSERT INTO archived_files (path, source, archived_at, rows) VALUES (?, ?, ?, ?)')
    .run(join(TMP, 'two.jsonl'), 'code', 2, oldRows);
  raw.close();

  await storeReady();
  const stats = (await archiveStats())!;
  assert.equal(stats.files, 2);
  assert.equal(stats.oldestTs, T - 50_000, 'backfilled from the stored JSON');
  assert.ok(stats.bytes > Buffer.byteLength(oldRows));

  assert.equal(await archiveRows([fileRows(join(TMP, 'three.jsonl'), 's3', 'c', T - 90_000)], 3), true);
  const after = (await archiveStats())!;
  assert.equal(after.files, 3, 'a write clears the memoised stats');
  assert.equal(after.oldestTs, T - 90_000);
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
