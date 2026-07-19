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
 */
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { FileRows } from './scan-pass.ts';

/** Bump when the shape of FileRows changes — invalidates every cached blob. */
const SCHEMA_VERSION = 1;

export function cacheDir(): string {
  return process.env.DASHBOARD_CACHE_DIR || join(homedir(), '.claude-dashboard-cache');
}

interface CachedFile {
  mtimeMs: number;
  size: number;
  rows: FileRows;
}

let db: any = null;
let ready: Promise<void> | null = null;
let disabled = false;

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
      `);

      const got = db.prepare('SELECT v FROM meta WHERE k = ?').get('schema_version');
      if (!got || Number(got.v) !== SCHEMA_VERSION) {
        db.exec('DELETE FROM files');
        db.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').run(
          'schema_version', String(SCHEMA_VERSION)
        );
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
