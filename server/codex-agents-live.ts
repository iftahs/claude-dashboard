/**
 * codex-agents-live.ts
 * getLiveCodexAgents() — the Codex counterpart of subagents-live.ts, returning
 * the SAME LiveSubagentsData shape so the Agents tab renders both surfaces with
 * one component.
 *
 * Data model: every Codex thread is one rollout file,
 *   <codexDir>/sessions/YYYY/MM/DD/rollout-<ts>-<threadId>.jsonl
 * A user thread (→ MainAgent) spawns Guardian review threads — short-lived
 * subagents that judge each planned action — as separate rollouts whose
 * session_meta carries `thread_source:'guardian_review'` and `parent_thread_id`
 * (→ LiveSubagent / RecentlyCompletedSubagent).
 *
 * Two file-system facts shape the design:
 *  - Guardian rollouts keep the mtime they were born with. Recency is therefore
 *    judged by the LAST RECORD TIMESTAMP and by size growth, never by mtime alone.
 *  - Rollouts are append-only and can be huge (a 59 MB user thread with 8 MB
 *    image-generation lines). Each file is scanned once and afterwards only the
 *    bytes appended since the last tick are read, so the per-thread token sum
 *    only ever grows (the UI count-up relies on that). Per-line work is gated by
 *    a regex on the first ~200 bytes so unrelated records never reach JSON.parse.
 */

import { open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { codexDir } from './scan.ts';
import { listRollouts, rolloutThreadId, ROLLOUT_TS_RE, type RolloutFile } from './codex-live.ts';
import type { LiveSubagent, LiveSubagentsData, MainAgent, RecentlyCompletedSubagent } from './subagents-live.ts';

// ---------------------------------------------------------------------------
// Thresholds — same semantics as subagents-live.ts
// ---------------------------------------------------------------------------

const LIVE_TTL_MS = 3_000;
/** Files modified or created this recently are (re)read every tick. */
const RECENT_FILE_WINDOW = 60 * 60_000;
/** An open turn counts as running only while the thread wrote something this recently. */
const ACTIVE_WINDOW = 5 * 60_000;
/** Finished guardian reviews linger this long (mirrors the CLI "Finished" list). */
const COMPLETED_WINDOW = 30 * 60_000;
/** A main thread pulses "active" while written to this recently … */
const MAIN_ACTIVE = 30_000;
/** … and stays listed, dimmed, for this long after its last write. */
const MAIN_LINGER = 60_000;
/** Forget per-file state once a thread has been silent this long (well past every display window). */
const PRUNE_AFTER = 2 * 60 * 60_000;
const SESSION_INDEX_TTL_MS = 30_000;
const READ_CHUNK = 1024 * 1024;
/** Lines longer than this (image payloads) are never parsed — only their timestamp is taken. */
const MAX_LINE = 2 * 1024 * 1024;
/** Enough of a line to hold timestamp + ordinal + type + payload.type. */
const HEAD_BYTES = 200;
/** A bit more, to see `"item":{"type":"UserMessage"` after the thread/turn ids. */
const ITEM_HEAD_BYTES = 400;

const TYPE_RE = /^\{"timestamp":"([^"]+)",(?:"ordinal":\d+,)?"type":"(session_meta|turn_context|token_usage_record|event_msg)"/;
const PAYLOAD_TYPE_RE = /"payload":\{"type":"([a-z_]+)"/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

// ---------------------------------------------------------------------------
// Per-file state (module-level, survives between ticks)
// ---------------------------------------------------------------------------

interface ThreadMeta {
  threadId: string;
  sessionId: string;
  parentThreadId: string;
  cwd: string;
  guardian: boolean;
  cliVersion: string;
}

export interface ThreadState {
  path: string;
  /** Bytes consumed up to the end of the last complete line. */
  offset: number;
  /** Trailing partial line carried between reads (byte-level, so multi-byte chars are safe). */
  carry: Buffer;
  /** The carried line already exceeded MAX_LINE — parse nothing but its timestamp when it completes. */
  carryOversized: boolean;
  meta: ThreadMeta | null;
  /** session_meta timestamp (ms). */
  startedAt: number;
  /** Timestamp of the last record (ms) — the real "last activity", NOT mtime. */
  lastTs: number;
  model: string;
  /** Σ token_usage_record (input − cached + output). Only ever grows. */
  effectiveTokens: number;
  openTurnId: string | null;
  lastTaskCompleteTs: number;
  firstUserText: string;
}

export function newThreadState(path: string): ThreadState {
  return {
    path,
    offset: 0,
    carry: Buffer.alloc(0),
    carryOversized: false,
    meta: null,
    startedAt: 0,
    lastTs: 0,
    model: '',
    effectiveTokens: 0,
    openTurnId: null,
    lastTaskCompleteTs: 0,
    firstUserText: '',
  };
}

const states = new Map<string, ThreadState>();
/** Size of every rollout at the previous tick — a change marks the file as a candidate even with a frozen mtime. */
const sizeSeen = new Map<string, number>();

// ---------------------------------------------------------------------------
// Line parsing
// ---------------------------------------------------------------------------

function parseSessionMeta(state: ThreadState, obj: any, ts: number): void {
  const p = obj.payload ?? {};
  const threadId = String(p.id ?? '') || rolloutThreadId(state.path);
  const sessionId = String(p.session_id ?? '');
  state.meta = {
    threadId,
    sessionId,
    parentThreadId: String(p.parent_thread_id ?? sessionId ?? ''),
    cwd: typeof p.cwd === 'string' ? p.cwd : '',
    guardian: p.thread_source === 'guardian_review' || (typeof p.source === 'object' && p.source !== null),
    cliVersion: typeof p.cli_version === 'string' ? p.cli_version : '',
  };
  const metaTs = Date.parse(p.timestamp ?? '');
  state.startedAt = Number.isNaN(metaTs) ? ts : metaTs;
}

function processLine(state: ThreadState, line: Buffer, oversized: boolean): void {
  const head = line.subarray(0, HEAD_BYTES).toString('utf8');
  const tsm = ROLLOUT_TS_RE.exec(head);
  if (!tsm) return;
  const ts = Date.parse(tsm[1]);
  if (Number.isNaN(ts)) return;
  if (ts > state.lastTs) state.lastTs = ts;
  if (oversized || line.length > MAX_LINE) return;

  const m = TYPE_RE.exec(head);
  if (!m) return;
  const type = m[2];

  let payloadType = '';
  if (type === 'event_msg') {
    const pm = PAYLOAD_TYPE_RE.exec(head);
    if (!pm) return;
    payloadType = pm[1];
    if (payloadType === 'item_completed') {
      // Only the FIRST user message is wanted (title fallback); everything else is skipped before parsing.
      if (state.firstUserText) return;
      if (!line.subarray(0, ITEM_HEAD_BYTES).toString('utf8').includes('"item":{"type":"UserMessage"')) return;
    } else if (payloadType !== 'task_started' && payloadType !== 'task_complete') {
      return; // token_count etc. — nothing the agents view needs
    }
  } else if (type === 'session_meta' && state.meta) {
    return;
  }

  let obj: any;
  try {
    obj = JSON.parse(line.toString('utf8'));
  } catch {
    return;
  }
  const p = obj?.payload ?? {};

  switch (type) {
    case 'session_meta':
      parseSessionMeta(state, obj, ts);
      break;
    case 'turn_context': {
      const model = p.model ?? p.collaboration_mode?.settings?.model;
      if (typeof model === 'string' && model) state.model = model;
      break;
    }
    case 'token_usage_record': {
      const u = p.usage ?? {};
      const eff = Math.max(0, num(u.input_tokens) - num(u.cached_input_tokens)) + num(u.output_tokens);
      state.effectiveTokens += eff;
      break;
    }
    case 'event_msg': {
      const turnId = typeof p.turn_id === 'string' ? p.turn_id : '';
      if (payloadType === 'task_started') {
        if (UUID_RE.test(turnId)) state.openTurnId = turnId; // 'rollout-N' pseudo-turns are ignored
      } else if (payloadType === 'task_complete') {
        if (turnId && turnId === state.openTurnId) state.openTurnId = null;
        if (ts > state.lastTaskCompleteTs) state.lastTaskCompleteTs = ts;
      } else if (payloadType === 'item_completed') {
        const content = p.item?.content;
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c?.type === 'text' && typeof c.text === 'string' && c.text.trim()) {
              state.firstUserText = c.text.replace(/\s+/g, ' ').trim().slice(0, 80);
              break;
            }
          }
        }
      }
      break;
    }
  }
}

/**
 * Read the bytes appended since `state.offset` and feed complete lines to the
 * parser. Splits on 0x0A at the byte level (UTF-8 never embeds it), so the
 * carried partial line survives chunk boundaries and multi-byte characters.
 * A file that shrank (rotated) restarts from scratch.
 */
export async function ingestRollout(state: ThreadState, size: number): Promise<void> {
  if (size < state.offset) {
    Object.assign(state, newThreadState(state.path));
  }
  if (size === state.offset) return;

  const fh = await open(state.path, 'r');
  try {
    const buf = Buffer.alloc(READ_CHUNK);
    let pos = state.offset;
    while (pos < size) {
      const { bytesRead } = await fh.read(buf, 0, Math.min(buf.length, size - pos), pos);
      if (bytesRead === 0) break;
      const chunk = buf.subarray(0, bytesRead);
      let start = 0;
      for (;;) {
        const nl = chunk.indexOf(0x0a, start);
        if (nl === -1) break;
        const piece = chunk.subarray(start, nl);
        const line = state.carry.length ? Buffer.concat([state.carry, piece]) : piece;
        try {
          processLine(state, line, state.carryOversized);
        } catch { /* one bad record never stops the file */ }
        state.carry = Buffer.alloc(0);
        state.carryOversized = false;
        start = nl + 1;
        state.offset = pos + start;
      }
      if (start < bytesRead) {
        const rest = chunk.subarray(start);
        if (state.carryOversized) {
          // Already past the cap — keep only the head we have.
        } else if (state.carry.length + rest.length > MAX_LINE) {
          state.carry = Buffer.from(Buffer.concat([state.carry, rest]).subarray(0, HEAD_BYTES));
          state.carryOversized = true;
        } else {
          state.carry = Buffer.concat([state.carry, rest]);
        }
      }
      pos += bytesRead;
    }
  } finally {
    await fh.close();
  }
}

// ---------------------------------------------------------------------------
// session_index.jsonl — user-facing thread titles (append-only, last entry per id wins)
// ---------------------------------------------------------------------------

let indexCache: { titles: Map<string, string>; at: number } | null = null;

async function readSessionIndex(): Promise<Map<string, string>> {
  if (indexCache && Date.now() - indexCache.at < SESSION_INDEX_TTL_MS) return indexCache.titles;
  const titles = new Map<string, string>();
  try {
    const text = await readFile(join(codexDir(), 'session_index.jsonl'), 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line);
        if (typeof o?.id === 'string' && typeof o?.thread_name === 'string' && o.thread_name) {
          titles.set(o.id.toLowerCase(), o.thread_name);
        }
      } catch { /* junk line */ }
    }
  } catch { /* no index yet */ }
  indexCache = { titles, at: Date.now() };
  return titles;
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

function fallbackMeta(path: string): ThreadMeta {
  return { threadId: rolloutThreadId(path), sessionId: '', parentThreadId: '', cwd: '', guardian: false, cliVersion: '' };
}

async function ingestPath(path: string, file: RolloutFile | undefined): Promise<ThreadState | null> {
  if (!file) return null;
  let st = states.get(path);
  if (!st) {
    st = newThreadState(path);
    states.set(path, st);
  }
  try {
    await ingestRollout(st, file.size);
  } catch {
    // Unreadable right now (locked / vanished) — keep whatever we had, or drop an empty stub.
    if (st.offset === 0) states.delete(path);
    return states.get(path) ?? null;
  }
  return st;
}

/** Exported with an injectable clock so the mapping can be exercised against historical rollouts. */
export async function computeLiveCodexAgents(now: number = Date.now()): Promise<LiveSubagentsData> {
  const files = await listRollouts();
  const byPath = new Map(files.map((f) => [f.path, f]));
  const pathByThreadId = new Map<string, string>();
  for (const f of files) {
    const id = rolloutThreadId(f.path);
    if (id) pathByThreadId.set(id, f.path);
  }

  // Candidates: recent by mtime OR birthtime (guardian mtimes are frozen), grown since
  // the last tick, or already tracked (cheap: a size == offset check, no read).
  const candidates = new Set<string>();
  for (const f of files) {
    const recent = now - f.mtime < RECENT_FILE_WINDOW || now - f.birthtime < RECENT_FILE_WINDOW;
    const prev = sizeSeen.get(f.path);
    const grew = prev !== undefined && prev !== f.size;
    if (recent || grew || states.has(f.path)) candidates.add(f.path);
    sizeSeen.set(f.path, f.size);
  }
  for (const p of sizeSeen.keys()) if (!byPath.has(p)) sizeSeen.delete(p);
  for (const p of states.keys()) if (!byPath.has(p)) states.delete(p);

  for (const p of candidates) await ingestPath(p, byPath.get(p));

  // A guardian's parent must be listed too (so the child has a home) even when the
  // parent itself fell out of the time window — pull it in by thread id.
  for (const p of [...candidates]) {
    const st = states.get(p);
    if (!st?.meta?.guardian) continue;
    const parentPath = pathByThreadId.get(st.meta.parentThreadId.toLowerCase());
    if (parentPath && !states.has(parentPath)) {
      await ingestPath(parentPath, byPath.get(parentPath));
    }
  }

  const titles = await readSessionIndex();
  const titleOf = (st: ThreadState): string =>
    titles.get((st.meta ?? fallbackMeta(st.path)).threadId.toLowerCase()) || st.firstUserText || 'Codex thread';

  const running: LiveSubagent[] = [];
  const recentlyCompleted: RecentlyCompletedSubagent[] = [];
  const mainAgents: MainAgent[] = [];
  const runningChildren = new Map<string, number>(); // parent path → running guardians

  // Guardians first — their running count feeds the parents' delegating/traffic state.
  for (const g of states.values()) {
    const meta = g.meta ?? fallbackMeta(g.path);
    if (!meta.guardian) continue;
    const parentPath = pathByThreadId.get(meta.parentThreadId.toLowerCase()) ?? '';
    const parentState = parentPath ? states.get(parentPath) : undefined;
    const parentTitle = parentState
      ? titleOf(parentState)
      : titles.get(meta.parentThreadId.toLowerCase()) || 'Codex thread';
    const openTurn = g.openTurnId !== null && now - g.lastTs < ACTIVE_WINDOW;
    const base = {
      key: g.path,
      parentKey: parentPath,
      name: 'Guardian review',
      description: `Auto-review of ${parentTitle}`.slice(0, 200),
      model: g.model || 'codex-auto-review',
      effectiveTokens: g.effectiveTokens,
      project: meta.cwd,
    };
    if (openTurn) {
      running.push({
        ...base,
        startedAt: g.startedAt || g.lastTs,
        lastActivity: g.lastTs,
        status: 'running',
        traffic: 'running',
      });
      if (parentPath) runningChildren.set(parentPath, (runningChildren.get(parentPath) ?? 0) + 1);
    } else if (g.lastTaskCompleteTs > 0 && now - g.lastTaskCompleteTs < COMPLETED_WINDOW) {
      recentlyCompleted.push({ ...base, completedAt: g.lastTaskCompleteTs, background: false });
    }
  }

  for (const u of states.values()) {
    const meta = u.meta ?? fallbackMeta(u.path);
    if (meta.guardian) continue;
    const kids = runningChildren.get(u.path) ?? 0;
    const openTurn = u.openTurnId !== null && now - u.lastTs < ACTIVE_WINDOW;
    const sinceWrite = now - u.lastTs;
    const selfActive = openTurn || sinceWrite < MAIN_ACTIVE;
    const sinceComplete = u.lastTaskCompleteTs > 0 ? now - u.lastTaskCompleteTs : Infinity;
    // Waiting (RED): the turn ended a while ago and nothing has happened since — the
    // thread is idle on the user. Biased to 'running' otherwise, like subagents-live.
    const waiting = !openTurn && kids === 0 && sinceComplete >= MAIN_ACTIVE && sinceComplete < ACTIVE_WINDOW;
    if (openTurn || sinceWrite < MAIN_LINGER || kids > 0 || waiting) {
      mainAgents.push({
        key: u.path,
        title: titleOf(u),
        project: meta.cwd,
        gitBranch: '',
        model: u.model || 'codex',
        startedAt: u.startedAt || u.lastTs,
        lastActivity: u.lastTs,
        effectiveTokens: u.effectiveTokens,
        active: selfActive,
        delegating: !selfActive && kids > 0,
        status: 'running',
        traffic: openTurn ? 'running' : waiting ? 'waiting' : 'running',
      });
    }
  }

  // Forget threads silent for hours (and not recent by file times either).
  for (const [p, st] of states) {
    const f = byPath.get(p);
    const recentFile = !!f && (now - f.mtime < RECENT_FILE_WINDOW || now - f.birthtime < RECENT_FILE_WINDOW);
    if (!recentFile && now - st.lastTs > PRUNE_AFTER && !runningChildren.has(p)) states.delete(p);
  }

  running.sort((a, b) => a.startedAt - b.startedAt);
  recentlyCompleted.sort((a, b) => b.completedAt - a.completedAt);
  mainAgents.sort((a, b) => b.lastActivity - a.lastActivity);
  const completedList = recentlyCompleted.slice(0, 25);
  const waitingCount = mainAgents.filter((m) => m.traffic === 'waiting').length;
  const runningCount = running.length + mainAgents.filter((m) => m.traffic === 'running').length;
  return {
    running,
    recentlyCompleted: completedList,
    mainAgents,
    counts: { running: runningCount, waiting: waitingCount, finished: completedList.length },
  };
}

// ---------------------------------------------------------------------------
// 3s TTL cache + single-flight (the Agents tab polls fast and StrictMode doubles mounts)
// ---------------------------------------------------------------------------

let cachedLive: LiveSubagentsData | null = null;
let cachedLiveAt = 0;
let inflight: Promise<LiveSubagentsData> | null = null;

export async function getLiveCodexAgents(): Promise<LiveSubagentsData> {
  const now = Date.now();
  if (cachedLive && now - cachedLiveAt < LIVE_TTL_MS) return cachedLive;
  if (inflight) return inflight;
  inflight = computeLiveCodexAgents()
    .then((data) => {
      cachedLive = data;
      cachedLiveAt = Date.now();
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
