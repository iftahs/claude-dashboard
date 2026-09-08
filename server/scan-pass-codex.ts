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
 *  - IDENTITY: `session_meta` (always line 0). A guardian review thread
 *    (thread_source 'guardian_review' / object-valued `source`) is a subagent of
 *    `parent_thread_id`: its rows are sidechain, sessionId = parent, agentId = own
 *    id, and one TaskSpawnRow makes it visible to the Subagents insight.
 *  - TOOLS: `event_msg/item_completed` only. The `response_item`
 *    custom_tool_call / function_call lines are JS-sandbox wrappers of the same
 *    items and would double-count. Item types are PascalCase.
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
  type ScannedFile,
  type UsageRow,
} from './scan-pass.ts';

/** item_completed payloads can carry base64 images; anything above this is skipped unparsed. */
const MAX_LINE_BYTES = 2 * 1024 * 1024;
/** How much of a line the header / event pre-filters look at. */
const HEADER_SCAN = 140;
const EVENT_SCAN = 260;

const HEADER_RE =
  /^\{"timestamp":"([^"]+)",(?:"ordinal":(\d+),)?"type":"(session_meta|turn_context|token_usage_record|event_msg|compacted|world_state)"/;
/** event_msg sub-types we parse. task_complete carries nothing we need, so it is not here. */
const EVENT_RE = /"payload":\{"type":"(token_count|task_started|item_completed|thread_settings_applied)"/;
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

/** A usage row whose model is resolved after the whole file has been read. */
interface PendingUsage {
  row: UsageRow;
  turnId: string;
  fallbackModel: string;
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
  let guardian = false;
  let metaCwd = '';
  let ctxCwd = '';
  const sessionId = () => (guardian ? parentId : ownId);

  // ---- model join state ----
  const turnModel = new Map<string, string>();
  let lastCtxModel = '';
  let lastSettingsModel = '';
  let worldModel = '';
  let currentTurnId = '';

  // ---- accumulators ----
  const records: PendingUsage[] = []; // token_usage_record (CLI >= 0.153)
  const recordIdx = new Map<string, number>(); // dedupKey -> index into records
  const legacy: PendingUsage[] = []; // token_count — used only when `records` stays empty
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
    return {
      dedupKey, ts,
      sessionId: sessionId(),
      model: '', // resolved below once every turn_context has been seen
      inputTokens: Math.max(0, num(u.input_tokens) - cached),
      outputTokens: num(u.output_tokens),
      cacheCreateTokens: num(u.cache_write_input_tokens),
      cacheReadTokens: cached,
      tools: [],
      isSidechain: guardian,
      rootSessionId: sessionId(),
      attributionAgent: guardian ? 'guardian_review' : '',
      attributionSkill: '', attributionMcpServer: '', attributionPlugin: '',
      projectPathRaw: '', // patched below
      gitBranch: '',
      source,
    };
  };

  // Every tool row gets a result row: merge.ts resolves errors, git commits and
  // pushes through toolResults only, never through the call row itself.
  const emitTool = (
    toolId: string, ts: number, turnId: string, name: string,
    filePath: string | null, isError: boolean, errorText: string,
  ) => {
    rows.toolCalls.push({
      toolId, ts, sessionId: sessionId(), name, isSidechain: guardian,
      mcpServer: extractMcpServer(name), filePath, gitBranch: '', projectPath: '', source,
    });
    rows.toolResults.push({ toolId, sessionId: sessionId(), isError, rejected: false, errorText, agentIdFromResult: null });
    if (isError) errorCount++;
    else nonErrorResultIds.push(toolId);
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

    switch (it.type) {
      case 'UserMessage': {
        // Guardian "user" messages are injected review prompts, not something typed.
        if (guardian) return;
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
        const failed = it.status === 'failed' || (typeof it.exit_code === 'number' && it.exit_code !== 0);
        let errorText = '';
        if (failed) {
          errorText = (str(it.stderr) || str(it.stdout) || str(it.aggregated_output)).slice(0, 200);
          if (!errorText && typeof it.exit_code === 'number') errorText = `exit code ${it.exit_code}`;
        }
        emitTool(id, ts, turnId, name, filePath ? hostPath(filePath) : null, failed, errorText);
        for (const pc of parsed) {
          const cmd = str(pc?.cmd);
          if (/git\s+commit/.test(cmd)) gitCommitIds.push(id);
          if (/git\s+push/.test(cmd)) gitPushIds.push(id);
        }
        return;
      }
      case 'FileChange': {
        // One row per changed file. merge.ts dedups tool rows by id, so each file
        // after the first gets a suffixed id instead of collapsing into one edit.
        const changes = it.changes && typeof it.changes === 'object' ? it.changes : {};
        const failed = it.status === 'failed';
        let n = 0;
        for (const [fp, ch] of Object.entries<any>(changes)) {
          const name = CHANGE_NAMES[str(ch?.type)] ?? 'Edit';
          emitTool(n === 0 ? id : `${id}#${n}`, ts, turnId, name, hostPath(fp), failed, '');
          n++;
        }
        return;
      }
      case 'McpToolCall': {
        // `mcp__<server>__<tool>` so the shared extractMcpServer() regex applies unchanged.
        const name = `mcp__${str(it.server) || 'unknown'}__${str(it.tool) || 'unknown'}`;
        const isError = it.result?.isError === true || it.status === 'failed';
        let errorText = '';
        if (isError && Array.isArray(it.result?.content)) {
          const tb = it.result.content.find((b: any) => b?.type === 'text' && typeof b.text === 'string');
          if (tb) errorText = String(tb.text).slice(0, 200);
        }
        emitTool(id, ts, turnId, name, null, isError, errorText);
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
        guardian = p.thread_source === 'guardian_review' || (p.source !== null && typeof p.source === 'object');
        parentId = guardian ? str(p.parent_thread_id) || str(p.session_id) || ownId : ownId;
        metaCwd = str(p.cwd);
        break;
      }
      case 'turn_context': {
        // reasoning_effort is also here, but FileRows has no slot for it — dropped.
        const turnId = str(p.turn_id);
        const model = str(p.model) || str(p.collaboration_mode?.settings?.model);
        if (turnId) {
          currentTurnId = turnId;
          if (model) turnModel.set(turnId, model); // last wins
        }
        if (model) lastCtxModel = model;
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
            break;
          }
          case 'token_count': {
            const u = p.info?.last_token_usage;
            if (!u || typeof u !== 'object') break;
            if (num(u.input_tokens) <= 0 && num(u.output_tokens) <= 0) break;
            legacy.push({
              row: makeUsageRow(`codex:${ownId}:${ordinal}`, ts, u),
              turnId: currentTurnId,
              fallbackModel: lastCtxModel || lastSettingsModel || worldModel, // most recent preceding turn_context
            });
            break;
          }
          case 'item_completed':
            handleItem(p, ts);
            break;
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
    if (e.turnId) lastOfTurn.set(e.turnId, e);
  }
  for (const [turnId, names] of toolsByTurn) {
    const e = lastOfTurn.get(turnId);
    if (e) e.row.tools = names;
  }
  rows.usage = chosen.map((e) => e.row);

  const projectPath = projectPathOf(metaCwd || ctxCwd);
  for (const r of rows.usage) r.projectPathRaw = projectPath;
  for (const t of rows.toolCalls) t.projectPath = projectPath;

  if (firstTs === Infinity) return rows; // nothing recognisable in the file

  const sid = sessionId();
  rows.sessions.push({
    sessionId: sid,
    fileIsSidechain: guardian,
    firstTs, lastTs,
    turns: guardian ? 0 : turns,
    compactions, errorCount, rejectionCount: 0,
    firstPrompt: guardian ? '' : firstPrompt,
    gitBranch: '', projectPath, file: path,
    agentId: guardian ? ownId : null,
    source,
    // The usage keys stand in for assistant-message ids so /api/sessions does not
    // drop the thread as an empty shell (assistantMsgs === 0).
    assistantKeys: rows.usage.map((r) => r.dedupKey),
    gitCommitIds, gitPushIds, nonErrorResultIds,
  });

  if (guardian) {
    rows.taskSpawns.push({
      toolId: ownId, ts: firstTs, sessionId: sid,
      subagentType: 'guardian_review', model: 'codex-auto-review', description: 'Guardian review',
      gitBranch: '', projectPath, source,
    });
    // merge.ts marks a spawn completed — and links it to the agent's session —
    // only through a result row carrying agentIdFromResult; the rollout's
    // existence is that completion.
    rows.toolResults.push({
      toolId: ownId, sessionId: sid, isError: false, rejected: false, errorText: '', agentIdFromResult: ownId,
    });
  }

  if (snippets.length) rows.corpus.push({ sessionId: sid, snippets });
  return rows;
}
