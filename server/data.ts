/**
 * data.ts — the single owner of scanned data.
 *
 * Replaces two independent scan+cache stacks (cache.ts over scan.ts::scanEvents,
 * and insights-scan.ts's own 30s cache) that walked the same tree and parsed the
 * same ~1.1 GB separately, concurrently, on every cold start.
 *
 * Pipeline:  list+stat  ->  parse only changed files  ->  merge  ->  events + insights
 *
 * Per-file rows are cached by (path, mtime, size), so a re-scan only re-parses
 * files that actually changed — typically 27 files/day out of 2,431. The rows are
 * also persisted (event-store.ts), which is what makes a container restart cheap:
 * without it every restart re-parsed the entire corpus from scratch.
 */
import { listScannedFiles, parseFiles, type FileRows, type ScannedFile } from './scan-pass.ts';
import { mergeRows } from './merge.ts';
import { readSessionMetas, type UsageEvent } from './scan.ts';
import type { InsightsData } from './insights-scan.ts';
import { loadRows, persistRows, pruneRows, storeReady } from './event-store.ts';

const TTL_MS = 5000;

interface CachedFile {
  mtimeMs: number;
  size: number;
  rows: FileRows;
}

/** path -> parsed rows for that exact file version. */
const rowCache = new Map<string, CachedFile>();

let events: UsageEvent[] = [];
let insights: InsightsData | null = null;
let computedAt = 0;
let fingerprint = -1;
let inflight: Promise<void> | null = null;
let loadedFromStore = false;

export interface ScanStats {
  files: number;
  reparsed: number;
  fromCache: number;
  ms: number;
}

let lastStats: ScanStats = { files: 0, reparsed: 0, fromCache: 0, ms: 0 };

export function lastScanStats(): ScanStats {
  return lastStats;
}

/** Cheap invalidation token: newest mtime combined with the file count, so that a
 *  deletion (which lowers the count without changing the newest mtime) is noticed. */
function fingerprintOf(files: ScannedFile[]): number {
  let newest = 0;
  for (const f of files) if (f.mtimeMs > newest) newest = f.mtimeMs;
  return newest * 100000 + files.length;
}

async function rescan(): Promise<void> {
  const t0 = performance.now();

  // Warm the in-memory row cache from disk once per process. This is the whole
  // point of the store: a fresh container starts with every file already parsed.
  if (!loadedFromStore) {
    loadedFromStore = true;
    try {
      for (const [path, cached] of await loadRows()) rowCache.set(path, cached);
    } catch (e) {
      console.error('[store] load failed, falling back to a full parse:', e);
    }
  }

  const files = await listScannedFiles();
  const fp = fingerprintOf(files);

  const stale: ScannedFile[] = [];
  for (const f of files) {
    const hit = rowCache.get(f.path);
    if (!hit || hit.mtimeMs !== f.mtimeMs || hit.size !== f.size) stale.push(f);
  }

  if (stale.length) {
    const parsed = await parseFiles(stale);
    for (const rows of parsed) {
      rowCache.set(rows.path, { mtimeMs: rows.mtimeMs, size: rows.size, rows });
    }
    void persistRows(parsed);
  }

  // Drop rows for files that disappeared, so deletions take effect.
  const live = new Set(files.map((f) => f.path));
  const gone: string[] = [];
  for (const path of rowCache.keys()) if (!live.has(path)) gone.push(path);
  for (const path of gone) rowCache.delete(path);
  if (gone.length) void pruneRows(gone);

  // Merge in the same deterministic order the files were listed in — several
  // session fields are "first file wins" and would otherwise flap between runs.
  const ordered: FileRows[] = [];
  for (const f of files) {
    const hit = rowCache.get(f.path);
    if (hit) ordered.push(hit.rows);
  }

  const sessionMetas = await readSessionMetas();
  const merged = mergeRows(ordered, sessionMetas);
  events = merged.events;
  insights = merged.insights;
  fingerprint = fp;
  computedAt = Date.now();

  lastStats = {
    files: files.length,
    reparsed: stale.length,
    fromCache: files.length - stale.length,
    ms: Math.round(performance.now() - t0),
  };
  console.log(
    `[store] ${lastStats.files} files, ${lastStats.reparsed} reparsed, ` +
      `${lastStats.fromCache} cached, ${events.length} events in ${lastStats.ms}ms`
  );
}

/** Refresh if the TTL elapsed; concurrent callers share one in-flight scan. */
async function ensureFresh(): Promise<void> {
  if (computedAt !== 0 && Date.now() - computedAt < TTL_MS) return;
  if (inflight) {
    await inflight;
    return;
  }
  inflight = rescan().catch((e) => {
    console.error('[store] scan failed:', e);
  });
  try {
    await inflight;
  } finally {
    inflight = null;
  }
}

export async function getEvents(): Promise<{ events: UsageEvent[]; computedAt: number }> {
  await ensureFresh();
  return { events, computedAt };
}

export async function getInsights(): Promise<{ insights: InsightsData; computedAt: number }> {
  await ensureFresh();
  return {
    insights: insights ?? {
      toolCalls: [], toolResults: new Map(), taskSpawns: [],
      sessionsMeta: new Map(), searchCorpus: new Map(),
    },
    computedAt,
  };
}

/** Validity token for memoised builder output (builder-cache.ts). Never rescans. */
export function dataFingerprint(): number {
  return fingerprint;
}

/** Prime both caches at boot — one pass now instead of two competing ones. */
export async function primeData(): Promise<void> {
  await storeReady();
  await ensureFresh();
}
