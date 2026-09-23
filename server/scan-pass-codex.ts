/**
 * scan-pass-codex.ts — the OpenAI Codex rollout parser.
 *
 * Codex (the ChatGPT desktop app's coding agent, and the `codex` CLI) writes one
 * JSONL "rollout" per thread under
 *   <codexDir>/sessions/YYYY/MM/DD/rollout-<local-iso>-<uuid>.jsonl
 * Every line is an envelope `{timestamp (UTC ISO), ordinal?, type, payload}`. This
 * module turns one rollout into the exact FileRows shape scan-pass.ts emits for
 * Claude transcripts, so merge.ts, data.ts and event-store.ts need no codex branch.
 * Like scan-pass.ts it is pure extraction — no cross-file reduction — and it is
 * dispatched from parseFileRows() when `file.source === 'codex'`.
 *
 * Record rules, verified against the on-disk corpus (CLI 0.128 → 0.153.1):
 *
 *  - USAGE: one row per `token_usage_record` (CLI >= 0.153). `usage.input_tokens`
 *    INCLUDES `cached_input_tokens`, so inputTokens = input − cached and
 *    cacheReadTokens = cached; effective (input + output + cacheCreate) therefore
 *    excludes cache reads exactly as it does for Claude. `response_id` is globally
 *    unique → dedupKey `codex:<response_id>`. `thread_token_usage` is cumulative and
 *    is never read. Files written by older CLIs have no token_usage_record at all;
 *    only then do `event_msg/token_count` lines (`info.last_token_usage`) count,
 *    keyed `codex:<thread>:<ordinal|lineIndex>` — never by timestamp, because a
 *    replayed rollout carries dozens of records under one timestamp.
 *  - MODEL: records carry none. It is joined from `turn_context` by turn_id; a
 *    record can precede its turn_context, so the join is deferred to the end of the
 *    file. Fallbacks: the latest `thread_settings_applied`, then `world_state`.
 *  - IDENTITY: `session_meta` (always line 0). A subagent thread (object-valued
 *    `source`, e.g. {"subagent":"review"}, or thread_source 'guardian_review') is
 *    a child of `parent_thread_id`: its rows are sidechain, sessionId = parent,
 *    agentId = own id. A non-guardian subagent is one spawn of its kind
 *    (`review`, `thread_spawn`, …), attributed under that kind. The guardian
 *    (thread_source 'guardian_review' / {"subagent":{"other":"guardian"}}) is
 *    different: one guardian thread is a long-lived reviewer that answers many approval
 *    requests (up to ~20), one per turn: each `task_complete` carries a JSON
 *    verdict in `last_agent_message`, and each verdict becomes one TaskSpawnRow
 *    (id `<thread>:<turn>`) — so the Subagents insight counts reviews, not threads.
 *    Only the `outcome` enum is read; the free-text rationale quotes commands and
 *    paths and is never stored. A 'deny' also becomes a rejected `GuardianReview`
 *    call on the parent thread: that verdict is the one record of the decision
 *    (a denied command leaves no item in the parent; a denied patch leaves a
 *    'declined' FileChange, which the reviewer rule under TOOLS keeps from
 *    counting a second time).
 *  - TOOLS: `event_msg/item_completed` only. The `response_item`
 *    custom_tool_call / function_call lines are JS-sandbox wrappers of the same
 *    items and would double-count. Item types are PascalCase. An item whose
 *    status is 'declined' never ran: it is never a success and never an error.
 *    It is a rejection only when a person made that call — the turn's
 *    `approvals_reviewer` (turn_context, else the latest thread_settings) is
 *    'user' or unrecorded, the same split the Claude parser makes. Under
 *    'auto_review' the guardian decided: its deny is already the GuardianReview
 *    row, and a review that failed (e.g. at a usage limit) decided nothing.
 *
 * History rows (counts and enums only — never diff text, messages or commands):
 *  - EFFORT / REASONING: `turn_context.effort` joined by turn_id exactly like the
 *    model (fallback `thread_settings.reasoning_effort`); reasoning tokens are
 *    `usage.reasoning_output_tokens`, already inside output_tokens.
 *  - RATE LIMITS: every `token_count.rate_limits` → one RateLimitSnapRow (resets_at
 *    is epoch SECONDS). An identical repeat of the previous snapshot for the same
 *    `limit_id` is skipped. `limit_id: 'premium'` snapshots carry null windows and
 *    are written milliseconds before every usage-limit error — a probe, not a
 *    reading.
 *  - LIMIT HITS: a user-thread `task_complete` whose `error.codex_error_info` is
 *    'usage_limit_exceeded' (key turn_id). The kind comes from the newest
 *    Codex-bucket snapshot before it, classified by WINDOW LENGTH, never by slot
 *    (the 'go' plan's primary IS the weekly window), and read with a 90% floor
 *    because that snapshot predates the refused request (97–100% in practice). A
 *    per-model bucket only counts when one of its windows reads 100%. Guardian
 *    threads are skipped: their parent's turn records the same wall.
 *  - TURNS: user-thread `task_complete.duration_ms` / `time_to_first_token_ms`
 *    (started_at / completed_at are epoch seconds). A replayed 'rollout-N' turn id
 *    yields neither a turn nor a limit hit, as the turn counter skips it.
 *  - LINES: FileChange `unified_diff` hunks for updates (hunk-length aware, so a
 *    removed `-- comment` line is not mistaken for a `---` header); whole `content`
 *    lines for adds (added) and deletes (removed). Declined / failed patches changed
 *    nothing and are skipped.
 *  - SESSION: `originator`, `cli_version` and `git.{repository_url,branch}` from
 *    session_meta; the branch is stamped on the thread's usage and tool rows too.
 *
 * Performance: a ~140-char header regex is the only work most lines get; JSON.parse
 * is paid for the handful of record types above, and `compacted` lines (1.3–3.8 MB
 * full-history replays) are counted from the header and never parsed. That keeps
 * the 59 MB user thread well under a second, so — unlike Claude transcripts —
 * there is no per-file size cap and `insightsSkipped` is always false.
 */
import { readFile } from 'node:fs/promises';
import {
  CORPUS_CAP_BYTES,
  extractMcpServer,
  num,
  type FileRows,
  type LimitHitRow,
  type LineChangeRow,
  type RateLimitSnapRow,
  type ScannedFile,
  type ToolResultRow,
  type TurnRow,
  type UsageRow,
} from './scan-pass.ts';

/** item_completed payloads can carry base64 images; anything above this is skipped unparsed. */
const MAX_LINE_BYTES = 2 * 1024 * 1024;
/** How much of a line the header / event pre-filters look at. */
const HEADER_SCAN = 140;
const EVENT_SCAN = 260;

const HEADER_RE =
  /^\{"timestamp":"([^"]+)",(?:"ordinal":(\d+),)?"type":"(session_meta|turn_context|token_usage_record|event_msg|compacted|world_state)"/;
/**
 * event_msg sub-types we parse. task_complete is a guardian verdict in guardian
 * threads, and a turn's latency / usage-limit error in user threads.
 */
const EVENT_RE = /"payload":\{"type":"(token_count|task_started|task_complete|item_completed|thread_settings_applied)"/;
const ITEM_RE = /"item":\{"type":"([A-Za-z]+)"/;
/** item_completed kinds that never yield a row — rejected from the header, before JSON.parse. */
const SKIP_ITEMS = new Set(['Reasoning', 'AgentMessage', 'FunctionCallOutput', 'ContextCompaction']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The desktop app's injected attachment manifest — never a user-typed prompt. */
const ATTACHMENT_MANIFEST_RE = /^#\s*Files mentioned by the user:/i;

/** parsed_cmd[0].type → dashboard tool name; anything else is a shell command. */
const COMMAND_NAMES: Record<string, string> = { read: 'Read', search: 'Grep', list_files: 'LS' };
/** FileChange change.type → dashboard tool name. */
const CHANGE_NAMES: Record<string, string> = { add: 'Write', update: 'Edit', delete: 'Delete' };
/** Tool name for an action a guardian review denied — the verdict does not say which tool it was. */
export const GUARDIAN_DENY_TOOL = 'GuardianReview';

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Windows drive paths come back from Codex with either separator; use backslashes like Claude Code does. */
function hostPath(p: string): string {
  return /^[A-Za-z]:\//.test(p) ? p.replace(/\//g, '\\') : p;
}

/** `file:///C:/Users/Iftah%20Saar/x.png` → `C:\Users\Iftah Saar\x.png`; POSIX URIs keep their leading slash. */
function fromFileUri(p: string): string {
  if (!p.startsWith('file://')) return hostPath(p);
  let rest = p.slice(7);
  try {
    rest = decodeURIComponent(rest);
  } catch {
    /* keep the raw form */
  }
  if (/^\/[A-Za-z]:\//.test(rest)) rest = rest.slice(1);
  return hostPath(rest);
}

/** Lower-cases the drive letter so a codex cwd equals decodeProjectPath()'s output for the same folder. */
function projectPathOf(cwd: string): string {
  if (!cwd) return '';
  const p = hostPath(cwd);
  return /^[A-Za-z]:\\/.test(p) ? p[0].toLowerCase() + p.slice(1) : p;
}

/** The thread uuid is the last path segment of every rollout name — the fallback identity when session_meta is missing. */
function threadIdFromFileName(path: string): string {
  const m = path.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
  return m ? m[1] : '';
}

function effective(r: UsageRow): number {
  return r.inputTokens + r.outputTokens + r.cacheCreateTokens;
}

/**
 * The kind of a subagent thread, from session_meta.source: 'review' for
 * {"subagent":"review"}, 'thread_spawn' for {"subagent":{"thread_spawn":{…}}},
 * the name for {"subagent":{"other":"<name>"}} (the guardian is 'guardian').
 * 'subagent' when the shape is unrecognised.
 */
function subagentKind(source: unknown): string {
  const sa = (source as any)?.subagent;
  if (typeof sa === 'string' && sa) return sa;
  if (sa && typeof sa === 'object') {
    if (typeof sa.other === 'string' && sa.other) return sa.other;
    const first = Object.keys(sa)[0];
    if (first) return first;
  }
  return 'subagent';
}

/**
 * The `outcome` of a guardian verdict ('allow' | 'deny'), or '' when the turn
 * ended without one (interrupted, errored). Nothing else leaves this function —
 * `rationale` is free text that quotes the reviewed command.
 */
function verdictOutcome(msg: unknown): string {
  if (typeof msg !== 'string' || !msg.trimStart().startsWith('{')) return '';
  try {
    const v = JSON.parse(msg);
    return typeof v?.outcome === 'string' ? v.outcome : '';
  } catch {
    return '';
  }
}

/**
 * Codex writes epoch SECONDS (`resets_at`, `started_at`); accept milliseconds and
 * ISO strings too so a format change degrades to a correct value, not a 1970 date.
 */
function epochMs(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v < 1e11 ? v * 1000 : v;
  if (typeof v === 'string' && v) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

const HUNK_RE = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/;

/**
 * Lines added / removed by a unified diff. Walks each hunk by the lengths its
 * `@@ -a,b +c,d @@` header declares, so a removed line that itself starts with
 * `-- ` (a SQL / Lua comment) is counted, not mistaken for a `---` file header.
 * A diff without parseable hunk headers falls back to counting +/- lines that
 * are not `+++ ` / `--- ` headers.
 */
export function countUnifiedDiff(diff: string): { added: number; removed: number } {
  const lines = diff.split('\n');
  let added = 0;
  let removed = 0;
  let oldLeft = 0;
  let newLeft = 0;
  let sawHunk = false;
  for (const l of lines) {
    if (oldLeft > 0 || newLeft > 0) {
      const c = l[0];
      if (c === '+') { added++; newLeft--; }
      else if (c === '-') { removed++; oldLeft--; }
      else if (c !== '\\') { oldLeft--; newLeft--; } // context; '\ No newline at end of file' is neither
      continue;
    }
    const m = HUNK_RE.exec(l);
    if (m) {
      sawHunk = true;
      oldLeft = m[1] === undefined ? 1 : Number(m[1]);
      newLeft = m[2] === undefined ? 1 : Number(m[2]);
    }
  }
  if (sawHunk) return { added, removed };
  added = 0;
  removed = 0;
  for (const l of lines) {
    if (l.startsWith('+') && !l.startsWith('+++ ')) added++;
    else if (l.startsWith('-') && !l.startsWith('--- ')) removed++;
  }
  return { added, removed };
}

/** Lines in a whole-file body; a trailing newline does not start another line. */
function countContentLines(content: string): number {
  if (!content) return 0;
  const n = content.split('\n').length;
  return content.endsWith('\n') ? n - 1 : n;
}

/** One FileChange entry → line counts, or null when it carries nothing countable. */
function changeLineCounts(ch: any): { added: number; removed: number } | null {
  if (!ch || typeof ch !== 'object') return null;
  if (typeof ch.unified_diff === 'string') return countUnifiedDiff(ch.unified_diff);
  if (typeof ch.content === 'string') {
    if (ch.type === 'add') return { added: countContentLines(ch.content), removed: 0 };
    if (ch.type === 'delete') return { added: 0, removed: countContentLines(ch.content) };
  }
  return null;
}

/** `token_count.rate_limits` → snapshot row; null when there is none. */
function rateLimitSnap(rl: any, ts: number): RateLimitSnapRow | null {
  if (!rl || typeof rl !== 'object') return null;
  const limitId = str(rl.limit_id) || 'codex'; // older CLIs write no limit_id: the Codex bucket
  const win = (w: any) => {
    if (!w || typeof w !== 'object') return { pct: null, min: null, resets: null };
    const inSec = numOrNull(w.resets_in_seconds);
    return {
      pct: numOrNull(w.used_percent),
      min: numOrNull(w.window_minutes),
      resets: epochMs(w.resets_at) ?? (inSec !== null ? ts + inSec * 1000 : null),
    };
  };
  const p = win(rl.primary);
  const s = win(rl.secondary);
  return {
    key: `${ts}|${limitId}`, ts, limitId,
    primaryPct: p.pct, primaryWindowMin: p.min, primaryResetsAt: p.resets,
    secondaryPct: s.pct, secondaryWindowMin: s.min, secondaryResetsAt: s.resets,
    planType: typeof rl.plan_type === 'string' ? rl.plan_type : null,
  };
}

/** Everything but the key and timestamp — two snapshots with the same signature say the same thing. */
function snapSignature(s: RateLimitSnapRow): string {
  return [
    s.limitId, s.planType, s.primaryPct, s.primaryWindowMin, s.primaryResetsAt,
    s.secondaryPct, s.secondaryWindowMin, s.secondaryResetsAt,
  ].join('|');
}

/**
 * The newest pre-hit snapshot was written before the refused request, so the
 * window that ran out reads just under 100 there (97–100 across the corpus).
 */
const LIMIT_NEAR_FULL_PCT = 90;
const DAY_MIN = 24 * 60;

/**
 * Which limit a usage_limit_exceeded turn hit, from the newest snapshots before
 * it. A per-model bucket ('premium') counts only when one of its windows reads
 * full — its usual null-window snapshot is a probe written just before every
 * limit error. Otherwise the fullest open Codex window at or above the floor
 * wins (ties → the longer window, which lifts later), classified by length.
 */
export function classifyLimitHit(
  codex: RateLimitSnapRow | null, other: RateLimitSnapRow | null, at: number,
): { kind: LimitHitRow['kind']; resetsAt: number | null } {
  const windows = (s: RateLimitSnapRow) => [
    { pct: s.primaryPct, min: s.primaryWindowMin, resetsAt: s.primaryResetsAt },
    { pct: s.secondaryPct, min: s.secondaryWindowMin, resetsAt: s.secondaryResetsAt },
  ].filter((w) => w.pct !== null && !(w.resetsAt !== null && w.resetsAt <= at)); // a lapsed window is empty again

  if (other) {
    const full = windows(other).find((w) => (w.pct as number) >= 100);
    if (full) return { kind: 'model', resetsAt: full.resetsAt };
  }
  if (codex) {
    let best: ReturnType<typeof windows>[number] | null = null;
    for (const w of windows(codex)) {
      const pct = w.pct as number;
      const bestPct = best ? (best.pct as number) : -1;
      if (pct > bestPct || (pct === bestPct && (w.min ?? 0) > (best?.min ?? 0))) best = w;
    }
    if (best && (best.pct as number) >= LIMIT_NEAR_FULL_PCT) {
      const kind = best.min === null ? 'unknown' : best.min < DAY_MIN ? 'session' : 'weekly';
      return { kind, resetsAt: best.resetsAt };
    }
  }
  return { kind: 'unknown', resetsAt: null };
}

/** `error.codex_error_info` is the enum string today; tolerate an object-keyed variant. */
function isUsageLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const info = (err as any).codex_error_info;
  if (info === 'usage_limit_exceeded') return true;
  return !!info && typeof info === 'object' && 'usage_limit_exceeded' in info;
}

/** A usage row whose model and effort are resolved after the whole file has been read. */
interface PendingUsage {
  row: UsageRow;
  turnId: string;
  fallbackModel: string;
  fallbackEffort: string;
}

/** A limit hit whose model is resolved after the whole file has been read. */
interface PendingLimitHit {
  row: LimitHitRow;
  turnId: string;
  fallbackModel: string;
}

/**
 * A declined item's result row. Whether it is a rejection depends on the turn's
 * approvals reviewer, which — like the model — is resolved once the file is read.
 */
interface PendingDecline {
  result: ToolResultRow;
  turnId: string;
  fallbackReviewer: string;
}

export async function parseCodexFileRows(file: ScannedFile): Promise<FileRows> {
  const { path, source, mtimeMs, size } = file;
  const rows: FileRows = {
    path, source, mtimeMs, size, insightsSkipped: false,
    usage: [], toolCalls: [], toolResults: [], taskSpawns: [], sessions: [], corpus: [],
  };

  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return rows;
  }

  // ---- identity: session_meta is line 0, the filename uuid is the fallback ----
  let ownId = threadIdFromFileName(path);
  let parentId = ownId;
  let subagent = false; // any child thread: sidechain rows under the parent
  let guardian = false; // the approval reviewer: one spawn per verdict, not per thread
  let kind = '';
  let metaCwd = '';
  let ctxCwd = '';
  let client = '';
  let clientVersion = '';
  let repoUrl = '';
  let gitBranch = '';
  const sessionId = () => (subagent ? parentId : ownId);

  // ---- model / effort join state ----
  const turnModel = new Map<string, string>();
  const turnEffort = new Map<string, string>();
  let lastCtxModel = '';
  let lastCtxEffort = '';
  let lastSettingsModel = '';
  let lastSettingsEffort = '';
  let worldModel = '';
  let currentTurnId = '';
  // ---- approvals reviewer ('user' | 'auto_review'), joined the same way ----
  const turnReviewer = new Map<string, string>();
  let lastReviewer = '';
  const declines: PendingDecline[] = [];

  // ---- rate-limit state: the newest snapshot per bucket, and the last one emitted per limit_id ----
  let lastCodexSnap: RateLimitSnapRow | null = null;
  let lastOtherSnap: RateLimitSnapRow | null = null;
  const lastSnapSig = new Map<string, string>();

  // ---- accumulators ----
  const records: PendingUsage[] = []; // token_usage_record (CLI >= 0.153)
  const recordIdx = new Map<string, number>(); // dedupKey -> index into records
  const legacy: PendingUsage[] = []; // token_count — used only when `records` stays empty
  const limitHits: PendingLimitHit[] = [];
  const rateLimitSnaps: RateLimitSnapRow[] = [];
  const lineChanges: LineChangeRow[] = [];
  const turnRows: TurnRow[] = [];
  const toolsByTurn = new Map<string, string[]>();
  const gitCommitIds: string[] = [];
  const gitPushIds: string[] = [];
  const nonErrorResultIds: string[] = [];
  const snippets: string[] = [];
  let snippetLen = 0;
  let firstPrompt = '';
  let turns = 0;
  let compactions = 0;
  let errorCount = 0;
  let rejectionCount = 0;
  let firstTs = Infinity;
  let lastTs = -Infinity;

  const addCorpus = (snippet: string) => {
    // Same per-session cap as the Claude parser; merge.ts applies it again globally.
    if (snippetLen < CORPUS_CAP_BYTES) {
      snippets.push(snippet);
      snippetLen += snippet.length + 1;
    }
  };

  const makeUsageRow = (dedupKey: string, ts: number, u: any): UsageRow => {
    const cached = num(u.cached_input_tokens);
    const row: UsageRow = {
      dedupKey, ts,
      sessionId: sessionId(),
      model: '', // resolved below once every turn_context has been seen (effort too)
      inputTokens: Math.max(0, num(u.input_tokens) - cached),
      outputTokens: num(u.output_tokens),
      cacheCreateTokens: num(u.cache_write_input_tokens),
      cacheReadTokens: cached,
      tools: [],
      isSidechain: subagent,
      rootSessionId: sessionId(),
      attributionAgent: guardian ? 'guardian_review' : subagent ? kind : '',
      attributionSkill: '', attributionMcpServer: '', attributionPlugin: '',
      projectPathRaw: '', // patched below
      gitBranch: '', // patched below
      source,
    };
    // Already inside output_tokens; left absent (→ null) when the CLI does not report it.
    const reasoning = numOrNull(u.reasoning_output_tokens);
    if (reasoning !== null) row.reasoningTokens = reasoning;
    return row;
  };

  // Every tool row gets a result row: merge.ts resolves errors, git commits and
  // pushes through toolResults only, never through the call row itself. A
  // declined item is provisionally `rejected`; the reviewer pass at the end of
  // the file clears that (and settles rejectionCount) for auto-reviewed turns.
  const emitTool = (
    toolId: string, ts: number, turnId: string, name: string,
    filePath: string | null, isError: boolean, errorText: string, declined = false,
  ) => {
    rows.toolCalls.push({
      toolId, ts, sessionId: sessionId(), name, isSidechain: subagent,
      mcpServer: extractMcpServer(name), filePath, gitBranch: '', projectPath: '', source,
    });
    const result: ToolResultRow = { toolId, sessionId: sessionId(), isError, rejected: declined, errorText, agentIdFromResult: null };
    rows.toolResults.push(result);
    if (declined) declines.push({ result, turnId, fallbackReviewer: lastReviewer });
    if (isError) errorCount++;
    else if (!declined) nonErrorResultIds.push(toolId);
    if (turnId) {
      let names = toolsByTurn.get(turnId);
      if (!names) { names = []; toolsByTurn.set(turnId, names); }
      names.push(name);
    }
  };

  const handleItem = (p: any, lineTs: number) => {
    const it = p.item;
    if (!it || typeof it !== 'object') return;
    const turnId = str(p.turn_id) || currentTurnId;
    const ts = num(p.completed_at_ms) || num(p.started_at_ms) || lineTs;
    const id = str(it.id);
    // The approval was declined — by the user or the auto-reviewer, settled at the
    // end of the file. Either way the action never ran: neither a success nor an error.
    const declined = it.status === 'declined';

    switch (it.type) {
      case 'UserMessage': {
        // A subagent's "user" messages are injected prompts (the guardian's review
        // requests, the parent's delegated task), not something the user typed.
        if (subagent) return;
        const content = Array.isArray(it.content) ? it.content : [];
        for (const c of content) {
          if (c?.type !== 'text' || typeof c.text !== 'string') continue;
          const t: string = c.text;
          if (!firstPrompt) {
            const trimmed = t.trim();
            // Codex prepends an attachment manifest ("# Files mentioned by the
            // user:") as its own text entry when files are dropped into the chat —
            // injected context, like Claude's '<...>' blocks, not the prompt.
            if (trimmed && !trimmed.startsWith('<') && !ATTACHMENT_MANIFEST_RE.test(trimmed)) {
              firstPrompt = trimmed.slice(0, 200);
            }
          }
          addCorpus(t.slice(0, 200));
        }
        return;
      }
      case 'CommandExecution': {
        const parsed: any[] = Array.isArray(it.parsed_cmd) ? it.parsed_cmd : [];
        const first = parsed[0];
        const name = COMMAND_NAMES[str(first?.type)] ?? 'Bash';
        const filePath = name !== 'Bash' ? str(first?.path) : '';
        const failed = !declined && (it.status === 'failed' || (typeof it.exit_code === 'number' && it.exit_code !== 0));
        let errorText = '';
        if (failed) {
          errorText = (str(it.stderr) || str(it.stdout) || str(it.aggregated_output)).slice(0, 200);
          if (!errorText && typeof it.exit_code === 'number') errorText = `exit code ${it.exit_code}`;
        }
        emitTool(id, ts, turnId, name, filePath ? hostPath(filePath) : null, failed, errorText, declined);
        // A declined command never ran, so it is no commit or push candidate at all.
        if (!declined) {
          for (const pc of parsed) {
            const cmd = str(pc?.cmd);
            if (/git\s+commit/.test(cmd)) gitCommitIds.push(id);
            if (/git\s+push/.test(cmd)) gitPushIds.push(id);
          }
        }
        return;
      }
      case 'FileChange': {
        // One row per changed file. merge.ts dedups tool rows by id, so each file
        // after the first gets a suffixed id instead of collapsing into one edit.
        // A declined patch changed nothing and was one decision: a single declined row.
        const changes = it.changes && typeof it.changes === 'object' ? it.changes : {};
        const failed = it.status === 'failed';
        let n = 0;
        for (const [fp, ch] of Object.entries<any>(changes)) {
          const name = CHANGE_NAMES[str(ch?.type)] ?? 'Edit';
          emitTool(n === 0 ? id : `${id}#${n}`, ts, turnId, name, hostPath(fp), failed, '', declined);
          if (declined) break;
          n++;
          // Counts only — the diff / content text never leaves this function.
          if (failed || !id) continue;
          const counted = changeLineCounts(ch);
          if (counted) {
            lineChanges.push({
              key: `${id}|${fp}`, ts, sessionId: sessionId(), source,
              filePath: hostPath(fp), added: counted.added, removed: counted.removed,
            });
          }
        }
        return;
      }
      case 'McpToolCall': {
        // `mcp__<server>__<tool>` so the shared extractMcpServer() regex applies unchanged.
        const name = `mcp__${str(it.server) || 'unknown'}__${str(it.tool) || 'unknown'}`;
        const isError = !declined && (it.result?.isError === true || it.status === 'failed');
        let errorText = '';
        if (isError && Array.isArray(it.result?.content)) {
          const tb = it.result.content.find((b: any) => b?.type === 'text' && typeof b.text === 'string');
          if (tb) errorText = String(tb.text).slice(0, 200);
        }
        emitTool(id, ts, turnId, name, null, isError, errorText, declined);
        return;
      }
      case 'WebSearch':
        emitTool(id, ts, turnId, 'WebSearch', null, it.status === 'failed', '');
        return;
      case 'Extension': {
        const kind = str(it.kind);
        const name =
          kind === 'web.search' ? 'WebSearch'
          : kind === 'image_gen.generation' ? 'ImageGen'
          : `Extension:${kind || 'unknown'}`;
        emitTool(id, ts, turnId, name, null, it.status === 'failed', '');
        return;
      }
      case 'ImageView':
        emitTool(id, ts, turnId, 'Read', fromFileUri(str(it.path)) || null, false, '');
        return;
      default:
        return; // Reasoning / AgentMessage / FunctionCallOutput / ContextCompaction / future kinds
    }
  };

  // Split on '\n' (never readline: U+2028/2029 are legal inside JSON strings).
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 2) continue;

    const h = HEADER_RE.exec(line.length > HEADER_SCAN ? line.slice(0, HEADER_SCAN) : line);
    if (!h) continue;
    const ts = Date.parse(h[1]);
    if (Number.isNaN(ts)) continue;
    if (ts < firstTs) firstTs = ts;
    if (ts > lastTs) lastTs = ts;
    const type = h[3];

    // Counted from the header only — these are multi-MB history replays.
    if (type === 'compacted') { compactions++; continue; }
    if (line.length > MAX_LINE_BYTES) continue;

    if (type === 'event_msg') {
      const head = line.length > EVENT_SCAN ? line.slice(0, EVENT_SCAN) : line;
      const em = EVENT_RE.exec(head);
      if (!em) continue;
      if (em[1] === 'item_completed') {
        const im = ITEM_RE.exec(head);
        if (im && SKIP_ITEMS.has(im[1])) continue;
      }
    }

    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const p = obj?.payload;
    if (!p || typeof p !== 'object') continue;
    const ordinal = h[2] !== undefined ? Number(h[2]) : i;

    switch (type) {
      case 'session_meta': {
        const id = str(p.id) || str(p.session_id);
        if (id) ownId = id;
        subagent = p.thread_source === 'guardian_review' || (p.source !== null && typeof p.source === 'object');
        kind = subagent ? subagentKind(p.source) : '';
        guardian = p.thread_source === 'guardian_review' || kind === 'guardian';
        parentId = subagent
          ? str(p.parent_thread_id) || str(p.source?.subagent?.thread_spawn?.parent_thread_id) || str(p.session_id) || ownId
          : ownId;
        metaCwd = str(p.cwd);
        client = str(p.originator);
        clientVersion = str(p.cli_version);
        if (p.git && typeof p.git === 'object') {
          // A remote can embed a token (https://user:token@host/…): keep the host and path only.
          repoUrl = str(p.git.repository_url).replace(/^([a-z][a-z0-9+.-]*:\/\/)[^@/]*@/i, '$1');
          gitBranch = str(p.git.branch);
        }
        break;
      }
      case 'turn_context': {
        const turnId = str(p.turn_id);
        const model = str(p.model) || str(p.collaboration_mode?.settings?.model);
        const reviewer = str(p.approvals_reviewer);
        // `effort`, not `reasoning_effort` (which turn_context does not carry).
        const effort = str(p.effort) || str(p.collaboration_mode?.settings?.reasoning_effort);
        if (turnId) {
          currentTurnId = turnId;
          if (model) turnModel.set(turnId, model); // last wins
          if (reviewer) turnReviewer.set(turnId, reviewer);
          if (effort) turnEffort.set(turnId, effort);
        }
        if (model) lastCtxModel = model;
        if (reviewer) lastReviewer = reviewer;
        if (effort) lastCtxEffort = effort;
        if (!ctxCwd) ctxCwd = str(p.cwd);
        break;
      }
      case 'world_state': {
        const model = str(p.state?.model);
        if (model) worldModel = model;
        break;
      }
      case 'token_usage_record': {
        const u = p.usage;
        if (!u || typeof u !== 'object') break;
        const responseId = str(p.response_id);
        const dedupKey = responseId ? `codex:${responseId}` : `codex:${ownId}:${ordinal}`;
        const entry: PendingUsage = {
          row: makeUsageRow(dedupKey, ts, u),
          turnId: str(p.turn_id) || currentTurnId,
          fallbackModel: lastSettingsModel || worldModel,
          fallbackEffort: lastSettingsEffort,
        };
        // Keep-max within the file, mirroring the Claude parser.
        const idx = recordIdx.get(dedupKey);
        if (idx === undefined) {
          recordIdx.set(dedupKey, records.length);
          records.push(entry);
        } else if (effective(entry.row) > effective(records[idx].row)) {
          records[idx] = entry;
        }
        break;
      }
      case 'event_msg': {
        switch (p.type) {
          case 'task_started': {
            const turnId = str(p.turn_id);
            if (turnId) currentTurnId = turnId;
            if (UUID_RE.test(turnId)) turns++; // skips 'rollout-N' replay ids
            break;
          }
          case 'thread_settings_applied': {
            const model = str(p.thread_settings?.model);
            if (model) lastSettingsModel = model;
            const reviewer = str(p.thread_settings?.approvals_reviewer);
            if (reviewer) lastReviewer = reviewer;
            const effort = str(p.thread_settings?.reasoning_effort);
            if (effort) lastSettingsEffort = effort;
            break;
          }
          case 'token_count': {
            const snap = rateLimitSnap(p.rate_limits, ts);
            if (snap) {
              if (snap.limitId === 'codex') lastCodexSnap = snap;
              else lastOtherSnap = snap;
              // A repeat of the previous reading for the same bucket adds nothing.
              const sig = snapSignature(snap);
              if (lastSnapSig.get(snap.limitId) !== sig) {
                lastSnapSig.set(snap.limitId, sig);
                rateLimitSnaps.push(snap);
              }
            }
            const u = p.info?.last_token_usage;
            if (!u || typeof u !== 'object') break;
            if (num(u.input_tokens) <= 0 && num(u.output_tokens) <= 0) break;
            legacy.push({
              row: makeUsageRow(`codex:${ownId}:${ordinal}`, ts, u),
              turnId: currentTurnId,
              fallbackModel: lastCtxModel || lastSettingsModel || worldModel, // most recent preceding turn_context
              fallbackEffort: lastCtxEffort || lastSettingsEffort,
            });
            break;
          }
          case 'item_completed':
            handleItem(p, ts);
            break;
          case 'task_complete': {
            if (!guardian) {
              // A user turn: its latency, and whether a usage limit ended it. Replayed
              // 'rollout-N' ids repeat a turn recorded (and counted) elsewhere. Other
              // subagent threads' turns are not the user's and are skipped.
              if (subagent) break;
              const turnId = str(p.turn_id);
              if (!UUID_RE.test(turnId)) break;
              const durationMs = numOrNull(p.duration_ms);
              if (durationMs !== null && durationMs >= 0) {
                turnRows.push({
                  key: turnId,
                  ts: epochMs(p.started_at) ?? ts - durationMs,
                  sessionId: sessionId(), source, durationMs,
                  ttftMs: numOrNull(p.time_to_first_token_ms),
                });
              }
              if (isUsageLimitError(p.error)) {
                const { kind, resetsAt } = classifyLimitHit(lastCodexSnap, lastOtherSnap, ts);
                limitHits.push({
                  row: { key: turnId, ts, sessionId: sessionId(), source, kind, model: '', resetsAt },
                  turnId,
                  fallbackModel: lastCtxModel || lastSettingsModel || worldModel,
                });
              }
              break;
            }
            // Guardian threads: one review per verdict. A turn that ended without
            // one (interrupted, errored) reviewed nothing.
            const outcome = verdictOutcome(p.last_agent_message);
            if (!outcome) break;
            const reviewId = `${ownId}:${str(p.turn_id) || ordinal}`;
            const rejected = outcome === 'deny';
            rows.taskSpawns.push({
              toolId: reviewId, ts, sessionId: sessionId(),
              subagentType: 'guardian_review', model: 'codex-auto-review', description: 'Guardian review',
              gitBranch: '', projectPath: '', source,
            });
            if (rejected) {
              // Main-thread, like the Claude tool_use a user rejects: it was the parent's action.
              rows.toolCalls.push({
                toolId: reviewId, ts, sessionId: sessionId(), name: GUARDIAN_DENY_TOOL, isSidechain: false,
                mcpServer: null, filePath: null, gitBranch: '', projectPath: '', source,
              });
              rejectionCount++;
            }
            // One result row serves both: agentIdFromResult marks the spawn completed in
            // merge.ts, and `rejected` reaches the rejections insight through the call above.
            rows.toolResults.push({
              toolId: reviewId, sessionId: sessionId(), isError: false, rejected, errorText: '', agentIdFromResult: ownId,
            });
            break;
          }
        }
        break;
      }
    }
  }

  // ---- resolve models; attach each turn's tools to the turn's LAST usage row ----
  // (the final response of the turn — the row the tool-usage charts key on).
  const chosen = records.length ? records : legacy; // any token_usage_record makes token_count irrelevant
  const lastOfTurn = new Map<string, PendingUsage>();
  for (const e of chosen) {
    e.row.model = (e.turnId && turnModel.get(e.turnId)) || e.fallbackModel || 'unknown';
    const effort = (e.turnId && turnEffort.get(e.turnId)) || e.fallbackEffort;
    if (effort) e.row.effort = effort; // absent = unknown (merge maps it to '')
    if (e.turnId) lastOfTurn.set(e.turnId, e);
  }
  for (const [turnId, names] of toolsByTurn) {
    const e = lastOfTurn.get(turnId);
    if (e) e.row.tools = names;
  }
  rows.usage = chosen.map((e) => e.row);

  // ---- declined items: a rejection only when a person, not the guardian, decided ----
  for (const d of declines) {
    const reviewer = (d.turnId && turnReviewer.get(d.turnId)) || d.fallbackReviewer;
    if (reviewer === 'auto_review') d.result.rejected = false;
    else rejectionCount++;
  }

  for (const h of limitHits) h.row.model = turnModel.get(h.turnId) || h.fallbackModel || 'unknown';
  rows.limitHits = limitHits.map((h) => h.row);
  rows.rateLimitSnaps = rateLimitSnaps;
  rows.lineChanges = lineChanges;
  rows.turns = turnRows;

  const projectPath = projectPathOf(metaCwd || ctxCwd);
  for (const r of rows.usage) { r.projectPathRaw = projectPath; r.gitBranch = gitBranch; }
  for (const t of rows.toolCalls) { t.projectPath = projectPath; t.gitBranch = gitBranch; }
  for (const t of rows.taskSpawns) { t.projectPath = projectPath; t.gitBranch = gitBranch; }

  if (firstTs === Infinity) return rows; // nothing recognisable in the file

  const sid = sessionId();
  rows.sessions.push({
    sessionId: sid,
    fileIsSidechain: subagent,
    firstTs, lastTs,
    turns: subagent ? 0 : turns,
    compactions, errorCount, rejectionCount,
    firstPrompt: subagent ? '' : firstPrompt,
    gitBranch, projectPath, file: path,
    agentId: subagent ? ownId : null,
    source,
    // The usage keys stand in for assistant-message ids so /api/sessions does not
    // drop the thread as an empty shell (assistantMsgs === 0).
    assistantKeys: rows.usage.map((r) => r.dedupKey),
    gitCommitIds, gitPushIds, nonErrorResultIds,
    // Absent rather than '' when unknown — merge takes the first non-empty value.
    ...(client ? { client } : {}),
    ...(clientVersion ? { clientVersion } : {}),
    ...(repoUrl ? { repoUrl } : {}),
  });

  // Any other subagent (/review, spawn_agent, …) ends its turns with findings or
  // prose, never a verdict, so the thread itself is the one spawn. merge.ts marks
  // a spawn completed — and links it to the agent's session — only through a
  // result row carrying agentIdFromResult; the rollout's existence is that completion.
  if (subagent && !guardian) {
    rows.taskSpawns.push({
      toolId: ownId, ts: firstTs, sessionId: sid,
      subagentType: kind, model: rows.usage[0]?.model || lastCtxModel || lastSettingsModel || worldModel || 'unknown',
      description: 'Codex subagent', gitBranch: '', projectPath, source,
    });
    rows.toolResults.push({
      toolId: ownId, sessionId: sid, isError: false, rejected: false, errorText: '', agentIdFromResult: ownId,
    });
  }

  if (snippets.length) rows.corpus.push({ sessionId: sid, snippets });
  return rows;
}
