/**
 * codex-agents-live.ts
 * getLiveCodexAgents() — the Codex counterpart of subagents-live.ts, returning
 * the SAME LiveSubagentsData shape (and running the same main-session state
 * machine, mainAgentState) so the Agents tab renders both platforms with one
 * component and one set of rules.
 *
 * Data model: every Codex thread is one rollout file,
 *   <codexDir>/sessions/YYYY/MM/DD/rollout-<ts>-<threadId>.jsonl
 * A user thread (→ MainAgent) spawns subagent threads as separate rollouts whose
 * session_meta carries an object-valued `source` and `parent_thread_id`
 * (→ LiveSubagent / RecentlyCompletedSubagent). Most are Guardian reviews
 * (`thread_source:'guardian_review'`, source {"subagent":{"other":"guardian"}}) —
 * short-lived reviewers that judge each planned action; other kinds (`review`,
 * `thread_spawn`, …) are ordinary delegated work. The split mirrors scan-pass-codex.ts.
 *
 * "Waiting" (red) mirrors the Claude rule — something only the user can resolve:
 *  - an approval pending: the open turn has a tool call with no output yet, under
 *    approval_policy 'on-request' with a person as the reviewer (under
 *    'auto_review' the Guardian decides, and shows as a running subagent);
 *  - an action the user declined, with no agent reply after it;
 *  - a turn that ended in an error (task_complete.error, e.g. usage_limit_exceeded).
 * A turn that simply finished is the soft "your turn" state, never red. Rollouts
 * have no explicit approval-request record, so this is inferred like Claude's.
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
import {
  ACTIVE_WINDOW,
  MAIN_ACTIVE,
  mainAgentState,
  tallyCounts,
  type LiveSubagent,
  type LiveSubagentsData,
  type MainAgent,
  type RecentlyCompletedSubagent,
} from './subagents-live.ts';

// ---------------------------------------------------------------------------
// Thresholds — the main-session ones (MAIN_ACTIVE, MAIN_LINGER, ACTIVE_WINDOW)
// are shared with subagents-live.ts
// ---------------------------------------------------------------------------

const LIVE_TTL_MS = 3_000;
/** Files modified or created this recently are (re)read every tick. */
const RECENT_FILE_WINDOW = 60 * 60_000;
/** Finished subagent threads linger this long (mirrors the CLI "Finished" list). */
const COMPLETED_WINDOW = 30 * 60_000;
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
/** What an oversized line keeps of its head — enough to reach a tool output's `call_id`. */
const OVERSIZED_KEEP = 1024;
/** How far into a call record to look for `call_id` before falling back to a full parse. */
const CALL_ID_SCAN = 16 * 1024;

const TYPE_RE =
  /^\{"timestamp":"([^"]+)",(?:"ordinal":\d+,)?"type":"(session_meta|turn_context|token_usage_record|event_msg|response_item)"/;
const PAYLOAD_TYPE_RE = /"payload":\{"type":"([a-z_]+)"/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `call_id` as a real key — inside an encoded arguments/input string its quotes are escaped. */
const CALL_ID_RE = /"call_id":"([^"\\]+)"/;
/** A tool call and its output (the JS-sandbox `custom_tool_call` wrapper pairs the same way). */
const CALL_TYPES = new Set(['function_call', 'custom_tool_call']);
const OUTPUT_TYPES = new Set(['function_call_output', 'custom_tool_call_output']);
const DECLINED_MARK = '"status":"declined"';

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ---------------------------------------------------------------------------
// Per-file state (module-level, survives between ticks)
// ---------------------------------------------------------------------------

interface ThreadMeta {
  threadId: string;
  sessionId: string;
  parentThreadId: string;
  cwd: string;
  /** A child thread of `parentThreadId` (object-valued `source`, or a guardian). */
  subagent: boolean;
  /** Subagent kind: 'guardian', 'review', 'thread_spawn', … ('' for a user thread). */
  kind: string;
  /** The approval reviewer (Guardian auto-review). */
  guardian: boolean;
  cliVersion: string;
  /** session_meta.git.branch ('' when the thread is not in a repo). */
  gitBranch: string;
}

export interface ThreadState {
  path: string;
  /** Bytes consumed up to the end of the last complete line. */
  offset: number;
  /** Trailing partial line carried between reads (byte-level, so multi-byte chars are safe). */
  carry: Buffer;
  /** The carried line already exceeded MAX_LINE — parse nothing but its head when it completes. */
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
  /** approval_policy / approvals_reviewer of the current turn (turn_context) … */
  turnApprovalPolicy: string;
  turnReviewer: string;
  /** … and the thread defaults (thread_settings_applied) a turn_context may omit. */
  threadApprovalPolicy: string;
  threadReviewer: string;
  /** call_ids of this turn's tool calls that have no output yet. */
  pendingCalls: Set<string>;
  /** The latest turn ended with an error (task_complete.error, e.g. usage_limit_exceeded). */
  turnError: boolean;
  /** A person declined an action and the agent has not replied since. */
  declined: boolean;
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
    turnApprovalPolicy: '',
    turnReviewer: '',
    threadApprovalPolicy: '',
    threadReviewer: '',
    pendingCalls: new Set(),
    turnError: false,
    declined: false,
  };
}

const states = new Map<string, ThreadState>();
/** Size of every rollout at the previous tick — a change marks the file as a candidate even with a frozen mtime. */
const sizeSeen = new Map<string, number>();

// ---------------------------------------------------------------------------
// Line parsing
// ---------------------------------------------------------------------------

/**
 * The kind of a subagent thread, from session_meta.source — same rule as
 * scan-pass-codex.ts: 'review' for {"subagent":"review"}, 'thread_spawn' for
 * {"subagent":{"thread_spawn":{…}}}, the name for {"subagent":{"other":"<name>"}}
 * (the guardian is 'guardian'); 'subagent' when the shape is unrecognised.
 */
export function codexSubagentKind(source: unknown): string {
  const sa = (source as any)?.subagent;
  if (typeof sa === 'string' && sa) return sa;
  if (sa && typeof sa === 'object') {
    if (typeof sa.other === 'string' && sa.other) return sa.other;
    const first = Object.keys(sa)[0];
    if (first) return first;
  }
  return 'subagent';
}

const KIND_LABELS: Record<string, string> = {
  guardian: 'Guardian review',
  review: 'Code review',
  thread_spawn: 'Spawned agent',
};

/** Card name for a subagent kind ("thread_spawn" → "Spawned agent", unknown kinds humanised). */
export function codexKindLabel(kind: string): string {
  if (KIND_LABELS[kind]) return KIND_LABELS[kind];
  const words = kind.replace(/[_-]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Subagent';
}

function parseSessionMeta(state: ThreadState, obj: any, ts: number): void {
  const p = obj.payload ?? {};
  const threadId = str(p.id) || rolloutThreadId(state.path);
  const sessionId = str(p.session_id);
  const subagent = p.thread_source === 'guardian_review' || (p.source !== null && typeof p.source === 'object');
  const kind = subagent ? codexSubagentKind(p.source) : '';
  state.meta = {
    threadId,
    sessionId,
    parentThreadId: subagent
      ? str(p.parent_thread_id) || str(p.source?.subagent?.thread_spawn?.parent_thread_id) || sessionId
      : '',
    cwd: str(p.cwd),
    subagent,
    kind,
    guardian: p.thread_source === 'guardian_review' || kind === 'guardian',
    cliVersion: str(p.cli_version),
    gitBranch: p.git && typeof p.git === 'object' ? str(p.git.branch) : '',
  };
  const metaTs = Date.parse(p.timestamp ?? '');
  state.startedAt = Number.isNaN(metaTs) ? ts : metaTs;
}

/** A person (not the Guardian) reviews approvals: 'user', or nothing recorded. */
function personReviews(state: ThreadState): boolean {
  const reviewer = state.turnReviewer || state.threadReviewer;
  return reviewer === '' || reviewer === 'user';
}

/** A call record's `call_id`: from the head when it is there, else (bounded lines only) a full parse. */
function callIdOf(line: Buffer, parseable: boolean): string {
  const m = CALL_ID_RE.exec(line.subarray(0, CALL_ID_SCAN).toString('utf8'));
  if (m) return m[1];
  if (!parseable || line.length <= CALL_ID_SCAN) return '';
  try {
    return str(JSON.parse(line.toString('utf8'))?.payload?.call_id);
  } catch {
    return '';
  }
}

function processLine(state: ThreadState, line: Buffer, oversized: boolean): void {
  const head = line.subarray(0, HEAD_BYTES).toString('utf8');
  const tsm = ROLLOUT_TS_RE.exec(head);
  if (!tsm) return;
  const ts = Date.parse(tsm[1]);
  if (Number.isNaN(ts)) return;
  if (ts > state.lastTs) state.lastTs = ts;

  const m = TYPE_RE.exec(head);
  if (!m) return;
  const type = m[2];
  const parseable = !oversized && line.length <= MAX_LINE;

  // Tool calls and their outputs: only the pairing matters (an open call under
  // 'on-request' is a possible approval prompt). A huge output still resolves its
  // call — its call_id sits in the first ~200 bytes, which an oversized line keeps.
  if (type === 'response_item') {
    const pm = PAYLOAD_TYPE_RE.exec(head);
    if (!pm) return;
    const isCall = CALL_TYPES.has(pm[1]);
    if (!isCall && !OUTPUT_TYPES.has(pm[1])) return;
    const callId = callIdOf(line, parseable);
    if (!callId) return;
    if (isCall) state.pendingCalls.add(callId);
    else state.pendingCalls.delete(callId);
    return;
  }
  if (!parseable) return;

  let payloadType = '';
  if (type === 'event_msg') {
    const pm = PAYLOAD_TYPE_RE.exec(head);
    if (!pm) return;
    payloadType = pm[1];
    if (payloadType === 'item_completed') {
      const itemHead = line.subarray(0, ITEM_HEAD_BYTES).toString('utf8');
      if (itemHead.includes('"item":{"type":"AgentMessage"')) {
        state.declined = false; // the agent answered after the decline
        return;
      }
      const wantsTitle = !state.firstUserText && itemHead.includes('"item":{"type":"UserMessage"');
      const maybeDeclined = line.indexOf(DECLINED_MARK) !== -1;
      if (!wantsTitle && !maybeDeclined) return; // everything else is skipped before parsing
    } else if (
      payloadType !== 'task_started' &&
      payloadType !== 'task_complete' &&
      payloadType !== 'thread_settings_applied'
    ) {
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
      state.turnApprovalPolicy = str(p.approval_policy);
      state.turnReviewer = str(p.approvals_reviewer);
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
        state.pendingCalls.clear();
        state.turnError = false;
        state.declined = false;
      } else if (payloadType === 'task_complete') {
        if (turnId && turnId === state.openTurnId) state.openTurnId = null;
        if (ts > state.lastTaskCompleteTs) state.lastTaskCompleteTs = ts;
        state.pendingCalls.clear();
        state.turnError = p.error !== null && p.error !== undefined;
      } else if (payloadType === 'thread_settings_applied') {
        const s = p.thread_settings ?? {};
        if (typeof s.approval_policy === 'string') state.threadApprovalPolicy = s.approval_policy;
        if (typeof s.approvals_reviewer === 'string') state.threadReviewer = s.approvals_reviewer;
      } else if (payloadType === 'item_completed') {
        const item = p.item ?? {};
        if (item.status === 'declined') {
          // A person's "no" — under 'auto_review' the Guardian decided, and its deny is
          // the reviewer's business, not the user's (same split as scan-pass-codex.ts).
          if (personReviews(state)) state.declined = true;
          break;
        }
        const content = item.content;
        if (!state.firstUserText && item.type === 'UserMessage' && Array.isArray(content)) {
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
          state.carry = Buffer.from(Buffer.concat([state.carry, rest]).subarray(0, OVERSIZED_KEEP));
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
  return {
    threadId: rolloutThreadId(path),
    sessionId: '',
    parentThreadId: '',
    cwd: '',
    subagent: false,
    kind: '',
    guardian: false,
    cliVersion: '',
    gitBranch: '',
  };
}

/**
 * The Codex side of the shared state machine (exported for the unit tests):
 *  - openTurn: a task_started without its task_complete, written to recently;
 *  - needsUser: an approval pending (open turn, a call with no output, policy
 *    'on-request', a person reviews), a person's decline with no reply after it,
 *    or a turn that ended in an error;
 *  - turnEnded: the last turn completed cleanly — the soft "your turn".
 */
export function codexMainSignals(st: ThreadState, now: number): { openTurn: boolean; needsUser: boolean; turnEnded: boolean } {
  const openTurn = st.openTurnId !== null && now - st.lastTs < ACTIVE_WINDOW;
  const policy = st.turnApprovalPolicy || st.threadApprovalPolicy;
  const pendingApproval = openTurn && st.pendingCalls.size > 0 && policy === 'on-request' && personReviews(st);
  const needsUser = pendingApproval || st.declined || (!openTurn && st.turnError);
  const turnEnded = !openTurn && !needsUser && st.lastTaskCompleteTs > 0;
  return { openTurn, needsUser, turnEnded };
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

  // A subagent's parent must be listed too (so the child has a home) even when the
  // parent itself fell out of the time window — pull it in by thread id.
  for (const p of [...candidates]) {
    const st = states.get(p);
    if (!st?.meta?.subagent) continue;
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
  const runningChildren = new Map<string, number>(); // parent path → running subagents

  // Subagents first — their running count feeds the parents' delegating/traffic state.
  for (const g of states.values()) {
    const meta = g.meta ?? fallbackMeta(g.path);
    if (!meta.subagent) continue;
    const parentPath = pathByThreadId.get(meta.parentThreadId.toLowerCase()) ?? '';
    const parentState = parentPath ? states.get(parentPath) : undefined;
    const parentTitle = parentState
      ? titleOf(parentState)
      : titles.get(meta.parentThreadId.toLowerCase()) || 'Codex thread';
    const openTurn = g.openTurnId !== null && now - g.lastTs < ACTIVE_WINDOW;
    const base = {
      key: g.path,
      parentKey: parentPath,
      name: codexKindLabel(meta.kind),
      description: (meta.guardian
        ? `Auto-review of ${parentTitle}`
        : titles.get(meta.threadId.toLowerCase()) || g.firstUserText || `Subagent of ${parentTitle}`
      ).slice(0, 200),
      model: g.model || (meta.guardian ? 'codex-auto-review' : 'codex'),
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
    if (meta.subagent) continue;
    const sinceWrite = now - u.lastTs;
    const { openTurn, needsUser, turnEnded } = codexMainSignals(u, now);
    const state = mainAgentState({
      sinceWrite,
      selfActive: openTurn || sinceWrite < MAIN_ACTIVE,
      runningChildren: runningChildren.get(u.path) ?? 0,
      needsUser,
      turnEnded,
    });
    if (!state.listed) continue;
    mainAgents.push({
      key: u.path,
      title: titleOf(u),
      project: meta.cwd,
      gitBranch: meta.gitBranch,
      model: u.model || 'codex',
      startedAt: u.startedAt || u.lastTs,
      lastActivity: u.lastTs,
      effectiveTokens: u.effectiveTokens,
      active: state.active,
      delegating: state.delegating,
      yourTurn: state.yourTurn,
      status: 'running',
      traffic: state.traffic,
    });
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
  return {
    running,
    recentlyCompleted: completedList,
    mainAgents,
    counts: tallyCounts(running, completedList, mainAgents),
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
