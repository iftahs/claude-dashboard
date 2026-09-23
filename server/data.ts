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
 *
 * With DASHBOARD_RETAIN_HISTORY=1 the rows of files that vanish (Claude Code's
 * cleanup deletes transcripts after ~30 days) are archived instead of dropped and
 * keep feeding the merge, after every live file. See event-store.ts.
 */
import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { listScannedFiles, parseFiles, type FileRows, type ScannedFile } from './scan-pass.ts';
import { mergeRows, reduceArchive, type ReducedArchive } from './merge.ts';
import { readSessionMetas, scanRoots, type ScanRoot, type UsageEvent, type UsageSource } from './scan.ts';
import type { InsightsData } from './insights-scan.ts';
import {
  archiveRows, archiveStats, forgetArchive, isUnder, loadArchive, loadRows, persistRows, pruneRows,
  retentionEnabled, slimRows, storeReady, unarchiveRows, underOwnRoot, type ArchivedFile,
} from './event-store.ts';

const TTL_MS = 5000;

/**
 * The time resolution of the memo token (see dataFingerprint): memoised builder
 * output never trails the scan clock by more than this.
 */
const MEMO_BUCKET_MS = 60_000;

interface CachedFile {
  mtimeMs: number;
  size: number;
  rows: FileRows;
}

/** path -> parsed rows for that exact file version. */
const rowCache = new Map<string, CachedFile>();

/**
 * path -> archived (slim) rows of a file that vanished. Loaded from the store once
 * per process, only when retention is on; empty otherwise.
 */
const archive = new Map<string, ArchivedFile>();
let archiveLoaded = false;
/** Bumped on every change to `archive`; folded into the fingerprint. */
let archiveGen = 0;
/** The archived files that merge (count) and their reduction, for one archive state. */
let archiveMerge: { key: string; count: number; reduced: ReducedArchive | null } | null = null;
/**
 * Vanished paths that could not be archived yet because their root looked
 * unmounted or empty (see classifyGone). Their rows stay in rowCache and in the
 * store — out of the merge, which only reads listed files — and are archived on
 * the first rescan where the root looks healthy, or simply come back if the files
 * do. Only paths new to this set count as a removal for the merge-reuse check.
 */
const pendingGone = new Set<string>();

let events: UsageEvent[] = [];
let insights: InsightsData | null = null;
let computedAt = 0;
let fingerprint = -1;
let inflight: Promise<void> | null = null;
let loadedFromStore = false;

/** What the current `events` / `insights` were merged from; null until the first merge. */
export interface MergeBasis {
  /** fingerprintOf() the file list (with the archive folded in when it is non-empty). */
  fingerprint: number;
  /** Hash of the session-meta sidecars (they feed project paths into the merge). */
  metaSig: number;
  /** archiveSig() of the archived rows in the merge; absent/0 when there are none. */
  archiveSig?: number;
}

let mergedFrom: MergeBasis | null = null;

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

/**
 * Cheap data-change token: the data half of the memo token (dataFingerprint) and
 * part of the merge-reuse check. Hashed from three things:
 *  - the newest mtime — the usual "something was appended" signal;
 *  - the file count — a deletion lowers it without moving the newest mtime;
 *  - the total byte size — Codex guardian rollouts keep the mtime they were created
 *    with while they grow, so without size a growing guardian file would change the
 *    per-file (path, mtime, size) staleness key below (and get re-parsed) yet leave
 *    this token untouched, and memoBuilder would keep serving stale aggregates.
 * Only ever compared for equality; hashing keeps it a safe integer (the old
 * `mtime * 1e5 + count` had already outgrown 2^53 and was silently losing bits).
 */
function fingerprintOf(files: ScannedFile[]): number {
  let newest = 0;
  let totalSize = 0;
  for (const f of files) {
    if (f.mtimeMs > newest) newest = f.mtimeMs;
    totalSize += f.size;
  }
  return hash53(`${newest}|${files.length}|${totalSize}`);
}

/** cyrb53 — a small, well-distributed 53-bit string hash; never returns the -1 sentinel. */
function hash53(s: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Whether the last merge result is still exact. mergeRows is a pure reduction of
 * (rows in listing order, session metas), so with no file re-parsed, added or
 * removed, the same fingerprint and the same sidecars it would rebuild the same
 * events and insights, yet with the dashboard open every 5s rescan used to pay
 * for a full-corpus merge even when idle. The fingerprint check also covers a
 * merge that threw after the row cache had already taken new rows.
 */
export function canReuseMerge(
  prev: MergeBasis | null,
  next: MergeBasis,
  reparsed: number,
  removed: number,
): boolean {
  return (
    prev !== null &&
    reparsed === 0 &&
    removed === 0 &&
    prev.fingerprint === next.fingerprint &&
    prev.metaSig === next.metaSig &&
    (prev.archiveSig ?? 0) === (next.archiveSig ?? 0)
  );
}

// ---------------------------------------------------------------------------
// History archive helpers — pure (the filesystem check is injectable) so the
// rules below are testable without a real ~/.claude.
// ---------------------------------------------------------------------------

type Exists = (p: string) => boolean;
type ListDir = (p: string) => string[];

function listDir(p: string): string[] {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A real Codex or Cowork install, by files neither the ~/.claude opt-out mount nor an empty mount point has. */
export function platformHome(root: ScanRoot, exists: Exists = existsSync, list: ListDir = listDir): boolean {
  if (root.source === 'codex') {
    const home = dirname(root.dir);
    return ['config.toml', 'auth.json', 'session_index.jsonl'].some((f) => exists(join(home, f)));
  }
  if (root.source === 'cowork') {
    return list(root.dir).some((acct) => UUID.test(acct) &&
      list(join(root.dir, acct)).some((profile) => UUID.test(profile) &&
        list(join(root.dir, acct, profile)).some((n) => /^local_.*\.json$/.test(n))));
  }
  return false;
}

/**
 * A root counts as present when its directory exists AND the current listing has
 * at least one file from it, or when it is a real platform home (so a user who
 * deleted every rollout keeps the history). The existence check alone is not
 * enough: with CODEX_DIR_HOST= (the Docker opt-out) compose mounts ~/.claude at the
 * codex path, and ~/.claude/sessions exists, so the codex root "exists" while
 * holding no rollouts.
 */
function rootPresent(
  root: ScanRoot,
  listedBySource: Map<UsageSource, number>,
  exists: Exists,
  list: ListDir,
): boolean {
  if ((listedBySource.get(root.source) ?? 0) > 0 && exists(root.dir)) return true;
  return platformHome(root, exists, list);
}

function countBySource(files: ScannedFile[]): Map<UsageSource, number> {
  const out = new Map<UsageSource, number>();
  for (const f of files) out.set(f.source, (out.get(f.source) ?? 0) + 1);
  return out;
}

/** Session, agent and rollout file names carry unique ids, so a name live elsewhere is a moved file. */
function nameKey(source: UsageSource, path: string): string {
  return `${source}|${basename(path)}`;
}

/**
 * Sources whose archived rows may join the merge. Claude Code always; Cowork and
 * Codex only while their root is present, so opting a platform out (e.g.
 * CODEX_DIR_HOST=) hides its archived history too instead of resurrecting a
 * platform switcher for data the user chose not to mount. Hidden rows stay stored.
 */
export function archiveSources(
  roots: ScanRoot[],
  files: ScannedFile[],
  exists: Exists = existsSync,
  list: ListDir = listDir,
): Set<UsageSource> {
  const listed = countBySource(files);
  const out = new Set<UsageSource>(['code']);
  for (const r of roots) if (r.source !== 'code' && rootPresent(r, listed, exists, list)) out.add(r.source);
  return out;
}

/** What to do with a vanished file's rows while retention is on. */
export type GoneAction = 'archive' | 'wait' | 'drop';

/**
 * Per vanished path:
 *  - 'archive' — it sits under the configured root of its own source and that
 *    root is present (see rootPresent): a real deletion, e.g. Claude Code cleanup.
 *  - 'wait'    — its root is configured but looks unmounted or emptied. That makes
 *    every file vanish at once; archiving would freeze a snapshot of data that is
 *    about to come back, so the rows are held (pendingGone) and decided later.
 *  - 'drop'    — no configured root contains it any more (CLAUDE_DIR pointed
 *    elsewhere), or the same file is live at another path (a renamed project
 *    folder): not a deletion. Dropped as without retention.
 */
export function classifyGone(
  gone: { path: string; source: UsageSource }[],
  roots: ScanRoot[],
  files: ScannedFile[],
  exists: Exists = existsSync,
  list: ListDir = listDir,
): Map<string, GoneAction> {
  const listed = countBySource(files);
  const liveNames = new Set(files.map((f) => nameKey(f.source, f.path)));
  const out = new Map<string, GoneAction>();
  for (const g of gone) {
    const root = roots.find((r) => r.source === g.source && isUnder(g.path, r.dir));
    const moved = liveNames.has(nameKey(g.source, g.path));
    out.set(g.path, !root || moved ? 'drop' : rootPresent(root, listed, exists, list) ? 'archive' : 'wait');
  }
  return out;
}

/**
 * The archived files that merge, after every live file, by archive time. Several
 * session fields are first-file-wins (projectPath, firstPrompt, file, …), so a live
 * file must always beat an archived copy of the same session. A file live again,
 * here or moved, never merges from the archive — that would double every per-file
 * counter (turns, errors, …) — nor does one outside its source's configured root.
 */
export function archivedForMerge(
  files: ScannedFile[],
  archived: Iterable<ArchivedFile>,
  allowed: Set<UsageSource>,
  roots: ScanRoot[],
): ArchivedFile[] {
  const live = new Set<string>();
  const liveNames = new Set<string>();
  for (const f of files) {
    live.add(f.path);
    liveNames.add(nameKey(f.source, f.path));
  }
  return [...archived]
    .filter((a) =>
      allowed.has(a.source) && !live.has(a.path) && !liveNames.has(nameKey(a.source, a.path)) &&
      underOwnRoot(a.path, a.source, roots))
    .sort((a, b) => a.archivedAt - b.archivedAt || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Validity token for the archived part of the merge input. 0 = nothing archived is merged. */
export function archiveSig(gen: number, includedCount: number, allowed: Set<UsageSource>, roots: ScanRoot[]): number {
  if (includedCount === 0) return 0;
  const rootSig = roots.map((r) => `${r.source}:${r.dir}`).join(',');
  return hash53(`${gen}|${includedCount}|${[...allowed].sort().join(',')}|${rootSig}`);
}

/**
 * The memo token for data fingerprint `fp` observed at `now`: the fingerprint plus
 * the minute `now` falls in. See dataFingerprint for why time is part of it.
 */
export function memoToken(fp: number, now: number): number {
  return hash53(`${fp}|${Math.floor(now / MEMO_BUCKET_MS)}`);
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

  const retain = retentionEnabled();
  if (retain && !archiveLoaded) {
    archiveLoaded = true;
    try {
      for (const a of await loadArchive()) archive.set(a.path, a);
      archiveGen++;
    } catch (e) {
      console.error('[store] archive load failed:', e);
    }
  }

  const files = await listScannedFiles();
  const roots = scanRoots();
  const live = new Set(files.map((f) => f.path));

  // A file that is back on disk leaves the archive: its live rows supersede the
  // archived copy (e.g. an archive made while a volume was not mounted). So does
  // one live again at another path (a renamed project folder).
  if (archive.size) {
    const liveNames = new Set(files.map((f) => nameKey(f.source, f.path)));
    const back: string[] = [];
    for (const [path, a] of archive) if (live.has(path) || liveNames.has(nameKey(a.source, path))) back.push(path);
    if (back.length) {
      for (const path of back) archive.delete(path);
      archiveGen++;
      void unarchiveRows(back);
    }
  }

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

  // Files that disappeared. Without retention their rows are dropped, so deletions
  // take effect. With it they are archived (slim) — unless their root looks
  // unmounted or empty, in which case they wait in pendingGone (see there).
  for (const path of pendingGone) if (live.has(path)) pendingGone.delete(path);
  const gone: string[] = [];
  for (const path of rowCache.keys()) if (!live.has(path)) gone.push(path);

  let removed = 0;
  if (gone.length) {
    const drop: string[] = [];
    if (retain) {
      const actions = classifyGone(
        gone.map((path) => ({ path, source: rowCache.get(path)!.rows.source })),
        roots,
        files,
      );
      const toArchive: FileRows[] = [];
      const archivedAt = Date.now();
      for (const path of gone) {
        const action = actions.get(path);
        if (action === 'archive') {
          const slim = slimRows(rowCache.get(path)!.rows);
          archive.set(path, { path, source: slim.source, archivedAt, rows: slim });
          toArchive.push(slim);
          pendingGone.delete(path);
          rowCache.delete(path);
          removed++;
        } else if (action === 'wait') {
          if (!pendingGone.has(path)) {
            pendingGone.add(path);
            removed++; // left the merge just now; it stays cached until it can be archived
          }
        } else {
          // Counted as removed only if it was still in the merge (not already pending).
          if (!pendingGone.delete(path)) removed++;
          rowCache.delete(path);
          drop.push(path);
        }
      }
      if (toArchive.length) {
        archiveGen++;
        // Prune the cache rows only once the archive write is durable: if it fails,
        // the next start finds them in the store again and retries.
        void archiveRows(toArchive, archivedAt).then((durable) => {
          if (durable) return pruneRows(toArchive.map((r) => r.path));
        });
      }
    } else {
      for (const path of gone) {
        rowCache.delete(path);
        drop.push(path);
      }
      pendingGone.clear();
      removed = drop.length;
    }
    if (drop.length) void pruneRows(drop);
  }

  // Live paths left the archive above, so its merged part changes only with this key.
  let aSig = 0;
  if (archive.size) {
    const allowed = archiveSources(roots, files);
    const key = `${archiveGen}|${[...allowed].sort().join(',')}|${roots.map((r) => `${r.source}:${r.dir}`).join(',')}`;
    if (archiveMerge?.key !== key) {
      const list = archivedForMerge(files, archive.values(), allowed, roots);
      archiveMerge = { key, count: list.length, reduced: list.length ? reduceArchive(list.map((a) => a.rows)) : null };
    }
    aSig = archiveSig(archiveGen, archiveMerge.count, allowed, roots);
  } else {
    archiveMerge = null;
  }
  const included = archiveMerge?.count ?? 0;
  // The archive is part of the data: fold it into the fingerprint (and with it the
  // memo token) so archiving, un-archiving and forgetting invalidate memoised
  // builder output. With nothing archived the token is exactly what it was.
  const fp = aSig ? hash53(`${fingerprintOf(files)}|${aSig}`) : fingerprintOf(files);

  const sessionMetas = await readSessionMetas();
  const basis: MergeBasis = { fingerprint: fp, metaSig: hash53(JSON.stringify(sessionMetas)), archiveSig: aSig };
  const reused = canReuseMerge(mergedFrom, basis, stale.length, removed);

  if (!reused) {
    // Merge in the same deterministic order the files were listed in — several
    // session fields are "first file wins" and would otherwise flap between runs —
    // then the archive, which must never win over a live file.
    const liveRows: FileRows[] = [];
    for (const f of files) {
      const hit = rowCache.get(f.path);
      if (hit) liveRows.push(hit.rows);
    }

    const merged = mergeRows(liveRows, sessionMetas, archiveMerge?.reduced ?? undefined);
    events = merged.events;
    insights = merged.insights;
    mergedFrom = basis;
  }
  fingerprint = fp;
  // Refreshed even when the merge is reused: it is the `now` every builder is
  // pinned to, and the TTL in ensureFresh() runs off it.
  computedAt = Date.now();

  lastStats = {
    files: files.length,
    reparsed: stale.length,
    fromCache: files.length - stale.length,
    ms: Math.round(performance.now() - t0),
  };
  console.log(
    `[store] ${lastStats.files} files, ${lastStats.reparsed} reparsed, ` +
      `${lastStats.fromCache} cached, ${events.length} events in ${lastStats.ms}ms` +
      (included ? `, ${included} archived files merged` : '') +
      (reused ? ' (merge reused)' : '')
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
      limitHits: [], rateLimitSnaps: [], lineChanges: [], prLinks: [], turns: [],
    },
    computedAt,
  };
}

/**
 * Validity token for memoised builder output (builder-cache.ts). Never rescans.
 *
 * The builders read `now` as well as the data: hourly buckets, "last N days"
 * cut-offs, today's day bucket. The file fingerprint alone only moves when a file
 * changes, so while nothing was being written every cached window froze at the
 * last write: the hourly chart stopped sliding and today's bucket never appeared
 * after midnight. Folding in the minute of computedAt, the same `now` the routes
 * pass to the builders, bounds that lag to a minute for one rebuild per key per
 * minute.
 */
export function dataFingerprint(): number {
  return memoToken(fingerprint, computedAt);
}

/** Prime both caches at boot — one pass now instead of two competing ones. */
export async function primeData(): Promise<void> {
  await storeReady();
  await ensureFresh();
}

/** Make the next getEvents/getInsights rescan instead of serving the TTL cache. */
export function invalidateData(): void {
  computedAt = 0;
}

export interface ArchiveSummary {
  enabled: boolean;
  files: number;
  oldestTs: number | null;
  bytes: number;
}

/**
 * What the history archive holds. Read from the store even with retention off, so
 * an archive left from an earlier opt-in stays visible (and forgettable). Falls
 * back to the in-memory copy when the store is unavailable.
 */
export async function archiveSummary(): Promise<ArchiveSummary> {
  const enabled = retentionEnabled();
  const stats = await archiveStats();
  if (stats) return { enabled, ...stats };
  let oldestTs: number | null = null;
  let bytes = 0;
  for (const a of archive.values()) {
    bytes += JSON.stringify(a.rows).length;
    for (const u of a.rows.usage) if (oldestTs === null || u.ts < oldestTs) oldestTs = u.ts;
    for (const s of a.rows.sessions) if (oldestTs === null || s.firstTs < oldestTs) oldestTs = s.firstTs;
  }
  return { enabled, files: archive.size, oldestTs, bytes };
}

/**
 * Delete the history archive, in memory and on disk, and force the next read to
 * re-merge without it. Waits out an in-flight scan first so that scan cannot
 * re-add what was just forgotten. Resolves false when the store could not delete it.
 */
export async function forgetArchivedHistory(): Promise<boolean> {
  if (inflight) await inflight;
  archive.clear();
  archiveMerge = null;
  archiveGen++;
  const ok = await forgetArchive();
  invalidateData();
  return ok;
}
