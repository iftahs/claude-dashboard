/**
 * event-store.ts — on-disk cache of parsed per-file rows.
 *
 * Without this, every process start re-parsed the whole corpus (~1.1 GB, ~10s).
 * With it, a restart re-parses only the files whose (mtime, size) changed —
 * typically 27 of 2,431 — and the rest are read back already parsed.
 *
 * Storage is one JSON blob per file version rather than a normalised schema.
 * The reduction that turns rows into endpoint shapes already lives in merge.ts and
 * re-runs on every load, so the store only has to answer "what did this exact file
 * version parse to". A blob does that in a fraction of the code, and the row shapes
 * can change without a migration beyond bumping SCHEMA_VERSION.
 *
 * Deliberately fail-soft: if SQLite is unavailable (node < 22.5, read-only volume,
 * corrupt db) every function degrades to a no-op and the app just parses from
 * scratch as it always did. A cache is never worth an outage.
 *
 * One table is NOT a cache: `archived_files`, the opt-in history archive
 * (DASHBOARD_RETAIN_HISTORY=1). Claude Code deletes transcripts after
 * cleanupPeriodDays (30 by default), and without this the dashboard forgets their
 * usage the moment the file goes. The archive keeps a slim copy (slimRows) of the
 * parsed rows of every file that vanished, and the SCHEMA_VERSION wipe never
 * touches it — there is no source left to rebuild it from.
 */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, normalize, sep } from 'node:path';
import type { FileRows } from './scan-pass.ts';
import { scanRoots, type ScanRoot, type UsageSource } from './scan.ts';

/**
 * Bump when the shape of FileRows — or what a parser puts in it — changes;
 * invalidates every cached blob.
 *   2: Codex rollouts (scan-pass-codex.ts) join the store; `source: 'codex'` rows.
 *   4: `rejected` requires an is_error result; insight rows from files up to 64 MB.
 *   5: a declined Codex item is never a success or a git commit/push candidate,
 *      and is a rejection only when the turn's approvals reviewer is the user;
 *      a non-guardian Codex subagent thread is one spawn of its own kind.
 *   6: history rows (limit hits, Codex rate-limit snapshots, line changes, PR links,
 *      turns, titles), effort / reasoning tokens, session cwd / client / repo URL.
 *   7: churn from edit inputs, synthetic lines end no turn, capped model family, no bare-429 hits.
 */
const SCHEMA_VERSION = 7;

export function cacheDir(): string {
  return process.env.DASHBOARD_CACHE_DIR || join(homedir(), '.claude-dashboard-cache');
}

/** Opt-in: keep the usage history of transcripts that Claude Code's cleanup deletes. */
export function retentionEnabled(): boolean {
  return process.env.DASHBOARD_RETAIN_HISTORY === '1';
}

interface CachedFile {
  mtimeMs: number;
  size: number;
  rows: FileRows;
}

/** One vanished file's slimmed rows, as the archive holds them. */
export interface ArchivedFile {
  path: string;
  source: UsageSource;
  /** When the file was archived (epoch ms). Archived rows merge in this order. */
  archivedAt: number;
  rows: FileRows;
}

export interface ArchiveStats {
  files: number;
  /** Stored size of the archived rows, in bytes. */
  bytes: number;
  /** Oldest usage/session timestamp the archive holds (epoch ms); null when empty. */
  oldestTs: number | null;
}

let db: any = null;
let ready: Promise<void> | null = null;
let disabled = false;
/** archiveStats() result, cleared on every archive write. */
let statsMemo: ArchiveStats | null = null;

export function isUnder(path: string, dir: string): boolean {
  const d = normalize(dir);
  return normalize(path).startsWith(d.endsWith(sep) ? d : d + sep);
}

/** Whether an archived path belongs to the data set the scan roots point at now. */
export function underOwnRoot(path: string, source: UsageSource, roots: ScanRoot[]): boolean {
  return roots.some((r) => r.source === source && isUnder(path, r.dir));
}

/**
 * Close the database and forget the open handle, so the next call reopens it
 * (possibly at a different DASHBOARD_CACHE_DIR). Tests use it to simulate a
 * restart; the server never needs it.
 */
export function closeStore(): void {
  try {
    db?.close();
  } catch {
    /* already closed */
  }
  db = null;
  ready = null;
  disabled = false;
  statsMemo = null;
}

/**
 * The archived copy of one file's rows: everything the aggregates need, and no
 * transcript text or error text.
 *
 * Kept: usage, tool calls, session partials (first prompts stay — the store is
 * local), limit hits, rate-limit snapshots, line counts, PR links, turn latencies,
 * titles, and task spawns with their description blanked.
 *
 * Dropped: the search corpus, and the tool results nothing reads — a non-error
 * result that resolves nothing, since a call without a result counts as a success.
 * Error results stay (failure and rejection rates) and so do the non-error ones
 * that resolve a session's git commit/push ids or a subagent's completion, all
 * with errorText forced to ''.
 *
 * Also a normaliser: rows written by an older parser may lack arrays merge.ts
 * iterates, so every array is defaulted. Idempotent.
 */
export function slimRows(rows: FileRows): FileRows {
  const sessions = (rows.sessions ?? []).map((s) => ({
    ...s,
    assistantKeys: s.assistantKeys ?? [],
    gitCommitIds: s.gitCommitIds ?? [],
    gitPushIds: s.gitPushIds ?? [],
    nonErrorResultIds: s.nonErrorResultIds ?? [],
  }));
  const gitIds = new Set<string>();
  for (const s of sessions) {
    for (const id of s.gitCommitIds) gitIds.add(id);
    for (const id of s.gitPushIds) gitIds.add(id);
  }
  const toolResults = (rows.toolResults ?? [])
    .filter((r) => r.isError || gitIds.has(r.toolId) || r.agentIdFromResult)
    .map((r) => ({
      toolId: r.toolId,
      sessionId: r.sessionId,
      isError: r.isError === true,
      rejected: r.rejected === true,
      errorText: '',
      agentIdFromResult: r.agentIdFromResult ?? null,
    }));

  return {
    path: rows.path,
    source: rows.source,
    mtimeMs: rows.mtimeMs,
    size: rows.size,
    insightsSkipped: rows.insightsSkipped === true,
    usage: rows.usage ?? [],
    toolCalls: rows.toolCalls ?? [],
    toolResults,
    taskSpawns: (rows.taskSpawns ?? []).map((t) => ({ ...t, description: '' })),
    sessions,
    corpus: [],
    limitHits: rows.limitHits ?? [],
    rateLimitSnaps: rows.rateLimitSnaps ?? [],
    lineChanges: rows.lineChanges ?? [],
    prLinks: rows.prLinks ?? [],
    turns: rows.turns ?? [],
    titles: rows.titles ?? [],
  };
}

const ARCHIVE_INSERT =
  'INSERT OR REPLACE INTO archived_files (path, source, archived_at, rows, bytes, oldest_ts) VALUES (?, ?, ?, ?, ?, ?)';

/** The stats columns stored next to an archived blob, so archiveStats never walks the JSON. */
function archiveColumns(rows: FileRows, json: string): [number, number | null] {
  let oldest: number | null = null;
  for (const u of rows.usage) if (oldest === null || u.ts < oldest) oldest = u.ts;
  for (const s of rows.sessions) if (oldest === null || s.firstTs < oldest) oldest = s.firstTs;
  return [Buffer.byteLength(json), oldest];
}

/**
 * Called on a schema bump, inside the transaction that wipes `files`: files whose
 * transcript is already gone can never be re-parsed, so their rows are archived
 * (slimmed) before the wipe instead of being lost with it. Rows parsed by the old
 * schema may lack newer fields; slimRows defaults them. A blob that no longer
 * parses is skipped — there is nothing to keep.
 *
 * Over-archiving is harmless: a path that is only temporarily missing (a volume
 * not mounted yet) leaves the archive again when data.ts sees it live. A path
 * outside its source's configured root is another data set and goes with the wipe.
 */
function archiveVanishedBeforeWipe(): number {
  const vanished: string[] = [];
  for (const r of db.prepare('SELECT path FROM files').all()) {
    if (!existsSync(r.path)) vanished.push(r.path);
  }
  if (!vanished.length) return 0;
  const roots = scanRoots();
  const read = db.prepare('SELECT rows FROM files WHERE path = ?');
  const put = db.prepare(ARCHIVE_INSERT);
  const now = Date.now();
  let n = 0;
  for (const path of vanished) {
    let rows: FileRows;
    try {
      rows = slimRows(JSON.parse(read.get(path).rows));
    } catch {
      continue;
    }
    if (!underOwnRoot(path, rows.source, roots)) continue;
    const json = JSON.stringify(rows);
    put.run(path, rows.source, now, json, ...archiveColumns(rows, json));
    n++;
  }
  return n;
}

/** Fill the stats columns of rows archived before they existed. Runs once per such row. */
function backfillArchiveColumns(): void {
  const pending = db.prepare('SELECT path FROM archived_files WHERE bytes IS NULL').all();
  const fill = db.prepare(
    `UPDATE archived_files SET bytes = LENGTH(CAST(rows AS BLOB)), oldest_ts = (
       SELECT MIN(t) FROM (
         SELECT MIN(json_extract(u.value, '$.ts')) AS t FROM json_each(archived_files.rows, '$.usage') u
         UNION ALL
         SELECT MIN(json_extract(s.value, '$.firstTs')) FROM json_each(archived_files.rows, '$.sessions') s
       )
     ) WHERE path = ?`
  );
  const sizeOnly = db.prepare('UPDATE archived_files SET bytes = LENGTH(CAST(rows AS BLOB)) WHERE path = ?');
  for (const { path } of pending) {
    try {
      fill.run(path);
    } catch {
      sizeOnly.run(path); // a blob SQLite cannot read as JSON: no oldest timestamp
    }
  }
}

/** Open (and migrate) the database once. Never throws — sets `disabled` instead. */
export function storeReady(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    try {
      const dir = cacheDir();
      await mkdir(dir, { recursive: true });

      // node:sqlite is built in from Node 22.5; older runtimes simply run uncached.
      const { DatabaseSync } = await import('node:sqlite');
      db = new DatabaseSync(join(dir, 'scan-cache.db'));

      // This is a rebuildable cache — durability is not worth an fsync per write.
      db.exec('PRAGMA journal_mode = WAL');
      db.exec('PRAGMA synchronous = NORMAL');
      db.exec(`
        CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS files (
          path     TEXT PRIMARY KEY,
          mtime_ms REAL    NOT NULL,
          size     INTEGER NOT NULL,
          rows     TEXT    NOT NULL
        );
        CREATE TABLE IF NOT EXISTS archived_files (
          path        TEXT PRIMARY KEY,
          source      TEXT NOT NULL,
          archived_at REAL NOT NULL,
          rows        TEXT NOT NULL,
          bytes       INTEGER,
          oldest_ts   REAL
        );
      `);
      const cols = new Set(db.prepare('PRAGMA table_info(archived_files)').all().map((c: any) => c.name));
      if (!cols.has('bytes')) db.exec('ALTER TABLE archived_files ADD COLUMN bytes INTEGER');
      if (!cols.has('oldest_ts')) db.exec('ALTER TABLE archived_files ADD COLUMN oldest_ts REAL');
      // Covers archiveStats, so it never reads past the row blobs.
      db.exec('CREATE INDEX IF NOT EXISTS archived_files_stats ON archived_files (bytes, oldest_ts)');

      const got = db.prepare('SELECT v FROM meta WHERE k = ?').get('schema_version');
      if (!got || Number(got.v) !== SCHEMA_VERSION) {
        // One transaction: if archiving fails the wipe rolls back with it and the
        // store is disabled for this run (parsing uncached) — retried next start —
        // rather than dropping rows that can no longer be re-parsed.
        db.exec('BEGIN');
        try {
          const archived = retentionEnabled() ? archiveVanishedBeforeWipe() : 0;
          db.exec('DELETE FROM files');
          db.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').run(
            'schema_version', String(SCHEMA_VERSION)
          );
          db.exec('COMMIT');
          if (archived) console.log(`[store] archived ${archived} vanished files before the schema wipe`);
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
        console.log(`[store] schema ${SCHEMA_VERSION} — cache rebuilt from scratch`);
      }
    } catch (e) {
      disabled = true;
      db = null;
      console.error('[store] disabled (parsing uncached):', (e as Error)?.message ?? e);
    }
  })();
  return ready;
}

/** Every cached file version, keyed by path. Empty when the store is unavailable. */
export async function loadRows(): Promise<Map<string, CachedFile>> {
  await storeReady();
  const out = new Map<string, CachedFile>();
  if (disabled || !db) return out;
  try {
    const t0 = performance.now();
    for (const r of db.prepare('SELECT path, mtime_ms, size, rows FROM files').all()) {
      try {
        out.set(r.path, { mtimeMs: r.mtime_ms, size: r.size, rows: JSON.parse(r.rows) });
      } catch {
        /* a single corrupt blob just means that file gets re-parsed */
      }
    }
    console.log(`[store] loaded ${out.size} cached files in ${Math.round(performance.now() - t0)}ms`);
  } catch (e) {
    console.error('[store] load failed:', (e as Error)?.message ?? e);
  }
  return out;
}

/** Upsert freshly parsed files. Fire-and-forget: callers must not await correctness on it. */
export async function persistRows(parsed: FileRows[]): Promise<void> {
  await storeReady();
  if (disabled || !db || !parsed.length) return;
  try {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO files (path, mtime_ms, size, rows) VALUES (?, ?, ?, ?)'
    );
    db.exec('BEGIN');
    try {
      for (const rows of parsed) {
        stmt.run(rows.path, rows.mtimeMs, rows.size, JSON.stringify(rows));
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (e) {
    console.error('[store] persist failed:', (e as Error)?.message ?? e);
  }
}

/** Forget files that no longer exist on disk. */
export async function pruneRows(paths: string[]): Promise<void> {
  await storeReady();
  if (disabled || !db || !paths.length) return;
  try {
    const stmt = db.prepare('DELETE FROM files WHERE path = ?');
    db.exec('BEGIN');
    try {
      for (const p of paths) stmt.run(p);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (e) {
    console.error('[store] prune failed:', (e as Error)?.message ?? e);
  }
}

// ---------------------------------------------------------------------------
// History archive (DASHBOARD_RETAIN_HISTORY=1). Never wiped by a schema bump.
// ---------------------------------------------------------------------------

/**
 * Archive the rows of files that vanished (slimmed again here, so nothing that
 * reaches this table ever carries transcript text). Resolves true when the rows
 * are durably stored — callers prune the file's cache row only after that, so a
 * failed write is retried on the next start instead of losing the history.
 */
export async function archiveRows(rows: FileRows[], archivedAt = Date.now()): Promise<boolean> {
  await storeReady();
  if (disabled || !db) return false;
  if (!rows.length) return true;
  statsMemo = null;
  try {
    const stmt = db.prepare(ARCHIVE_INSERT);
    db.exec('BEGIN');
    try {
      for (const r of rows) {
        const slim = slimRows(r);
        const json = JSON.stringify(slim);
        stmt.run(slim.path, slim.source, archivedAt, json, ...archiveColumns(slim, json));
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return true;
  } catch (e) {
    console.error('[store] archive failed:', (e as Error)?.message ?? e);
    return false;
  }
}

/** Every archived file, oldest archive first (the order they merge in). */
export async function loadArchive(): Promise<ArchivedFile[]> {
  await storeReady();
  const out: ArchivedFile[] = [];
  if (disabled || !db) return out;
  try {
    const all = db
      .prepare('SELECT path, source, archived_at, rows FROM archived_files ORDER BY archived_at, path')
      .all();
    for (const r of all) {
      try {
        out.push({
          path: r.path,
          source: r.source as UsageSource,
          archivedAt: r.archived_at,
          rows: slimRows(JSON.parse(r.rows)),
        });
      } catch {
        /* a corrupt blob is skipped, not fatal */
      }
    }
    if (out.length) console.log(`[store] loaded ${out.length} archived files`);
  } catch (e) {
    console.error('[store] archive load failed:', (e as Error)?.message ?? e);
  }
  return out;
}

/** Drop archive entries whose file is back on disk (the live rows supersede them). */
export async function unarchiveRows(paths: string[]): Promise<void> {
  await storeReady();
  if (disabled || !db || !paths.length) return;
  statsMemo = null;
  try {
    const stmt = db.prepare('DELETE FROM archived_files WHERE path = ?');
    db.exec('BEGIN');
    try {
      for (const p of paths) stmt.run(p);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (e) {
    console.error('[store] unarchive failed:', (e as Error)?.message ?? e);
  }
}

/** Delete the whole archive. Resolves true when it is gone. */
export async function forgetArchive(): Promise<boolean> {
  await storeReady();
  if (disabled || !db) return false;
  statsMemo = null;
  try {
    db.exec('DELETE FROM archived_files');
    return true;
  } catch (e) {
    console.error('[store] forget failed:', (e as Error)?.message ?? e);
    return false;
  }
}

/** Size and reach of the archive; null when the store is unavailable. Memoised: node:sqlite blocks the loop. */
export async function archiveStats(): Promise<ArchiveStats | null> {
  await storeReady();
  if (disabled || !db) return null;
  if (statsMemo) return statsMemo;
  try {
    const query = db.prepare(
      'SELECT COUNT(*) AS n, COUNT(bytes) AS sized, COALESCE(SUM(bytes), 0) AS bytes, MIN(oldest_ts) AS oldest FROM archived_files'
    );
    let agg = query.get();
    if (Number(agg?.sized ?? 0) < Number(agg?.n ?? 0)) {
      backfillArchiveColumns();
      agg = query.get();
    }
    const v = Number(agg?.oldest);
    statsMemo = {
      files: Number(agg?.n ?? 0),
      bytes: Number(agg?.bytes ?? 0),
      oldestTs: agg?.oldest == null || !Number.isFinite(v) ? null : v,
    };
    return statsMemo;
  } catch (e) {
    console.error('[store] archive stats failed:', (e as Error)?.message ?? e);
    return null;
  }
}
