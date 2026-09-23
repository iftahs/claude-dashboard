/**
 * scan-pass.ts — the single file-reading pass.
 *
 * Replaces the two independent scanners (scan.ts::scanEvents and
 * insights-scan.ts::scanInsights) that each walked the same tree and ran their
 * own JSON.parse over the same ~1.1 GB. One walk, one read, one parse per line,
 * feeding both consumers.
 *
 * This module is deliberately *pure extraction*: it emits flat per-file rows and
 * does no cross-file reduction. All dedup and accumulation happens in merge.ts.
 * That split is what makes per-file caching correct — 28% of dedup keys appear in
 * more than one file, so per-file aggregates cannot be pre-summed without
 * double-counting. Rows carry their dedup keys; merge.ts reduces globally.
 *
 * Reading strategy is measured, not assumed (see docs in the perf report):
 * the scan is CPU-bound on JSON.parse, not I/O — raw reads of the whole corpus
 * take 0.69s while parsing every line takes 6.6s. Hence:
 *   - a substring pre-filter before JSON.parse on the usage-only path
 *   - a bounded pool of PARSE_CONCURRENCY (8 measured optimal; 16 and 24 are worse)
 *
 * OpenAI Codex rollouts (`source: 'codex'`) are a different on-disk format and are
 * handed to scan-pass-codex.ts, which emits the same FileRows. That module imports
 * the row types and a few helpers from here (a benign import cycle: every binding
 * is only touched inside a function, after both modules have evaluated).
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { keepScanFile, scanRoots, type UsageSource } from './scan.ts';
import { parseCodexFileRows } from './scan-pass-codex.ts';

/** Measured optimum on an NVMe SSD: 1→4.28s, 8→3.11s, 16→3.27s, 24→3.74s. */
export const PARSE_CONCURRENCY = 8;

/**
 * Files above this size feed usage rows only, not insights. It was 5 MB (inherited
 * from insights-scan.ts), which silently dropped the longest sessions from the
 * Sessions and Insights tabs. Every file is read whole for its usage rows anyway;
 * parsing the rest of a big one costs CPU once (the row cache keeps the result) and
 * adds rows that grow with tool calls, not bytes. Measured on 31 files over 5 MB
 * (largest 24 MB): +0.3s once, ~1 MB more retained heap, ~5 MB more in the SQLite
 * cache. The cap now only guards against pathological transcripts.
 */
export const INSIGHTS_MAX_FILE_BYTES = 64 * 1024 * 1024;

/** Per-session search-corpus cap applied at parse time (and again globally in merge.ts). */
export const CORPUS_CAP_BYTES = 20 * 1024;

// ---------------------------------------------------------------------------
// Row types — flat, serialisable, no Maps. Everything here can go straight into
// SQLite and come back out unchanged.
// ---------------------------------------------------------------------------

export interface UsageRow {
  dedupKey: string; // `${requestId}:${message.id}` — ':' when both absent
  ts: number;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  tools: string[];
  isSidechain: boolean;
  rootSessionId: string;
  attributionAgent: string;
  attributionSkill: string;
  attributionMcpServer: string;
  attributionPlugin: string;
  /** Path decoded from the file location. The session-meta override is applied in merge.ts. */
  projectPathRaw: string;
  gitBranch: string;
  source: UsageSource;
  /** Reasoning effort this request ran at ('low'…'max'); '' or absent when unknown. */
  effort?: string;
  /** Thinking/reasoning share of outputTokens, when the log reports it; null/absent = unknown. */
  reasoningTokens?: number | null;
}

export interface ToolCallRow {
  toolId: string;
  ts: number;
  sessionId: string;
  name: string;
  isSidechain: boolean;
  mcpServer: string | null;
  filePath: string | null;
  gitBranch: string;
  projectPath: string;
  source: UsageSource;
}

export interface ToolResultRow {
  toolId: string;
  sessionId: string;
  isError: boolean;
  rejected: boolean;
  errorText: string;
  /** Extracted here so merge.ts never has to re-read result bodies. */
  agentIdFromResult: string | null;
}

export interface TaskSpawnRow {
  toolId: string;
  ts: number;
  sessionId: string;
  subagentType: string;
  model: string | null;
  description: string;
  gitBranch: string;
  projectPath: string;
  source: UsageSource;
}

export interface SessionPartialRow {
  sessionId: string;
  fileIsSidechain: boolean;
  firstTs: number;
  lastTs: number;
  turns: number;
  compactions: number;
  errorCount: number;
  rejectionCount: number;
  firstPrompt: string;
  gitBranch: string;
  projectPath: string;
  file: string;
  agentId: string | null;
  source: UsageSource;
  /** Distinct assistant-message identities seen in this file (for assistantMsgs). */
  assistantKeys: string[];
  /** tool_use ids of git commit/push commands, resolved against results in merge.ts. */
  gitCommitIds: string[];
  gitPushIds: string[];
  /** tool_use ids whose result came back non-error — resolves the two lists above. */
  nonErrorResultIds: string[];
  /** Real working directory from the transcript (Claude Code only; '' for Cowork). */
  cwd?: string;
  /** Client that wrote the file: Claude `entrypoint` (cli, claude-desktop, sdk-cli…) or Codex `originator`. */
  client?: string;
  clientVersion?: string;
  /** Git remote of the working directory, when the log records it (Codex session_meta.git). */
  repoUrl?: string;
}

// Per-item rows added for history features. Each carries its own identity so
// merge.ts can dedup across files (a resumed transcript repeats earlier lines);
// never pre-sum these per file.

/** A request the provider refused for a usage limit. */
export interface LimitHitRow {
  key: string; // message uuid (Claude) / turn id (Codex)
  ts: number;
  sessionId: string;
  source: UsageSource;
  /** Which limit: the rolling session/5-hour window, the weekly one, a per-model cap, or unknown. */
  kind: 'session' | 'weekly' | 'model' | 'unknown';
  model: string;
  /** When the provider said the limit lifts (epoch ms), if it said. */
  resetsAt: number | null;
}

/** One Codex rate-limit snapshot (event_msg token_count.rate_limits). */
export interface RateLimitSnapRow {
  key: string; // `${ts}|${limitId}`
  ts: number;
  limitId: string;
  primaryPct: number | null;
  primaryWindowMin: number | null;
  primaryResetsAt: number | null;
  secondaryPct: number | null;
  secondaryWindowMin: number | null;
  secondaryResetsAt: number | null;
  planType: string | null;
}

/** Lines added/removed by one edit — counts only, never diff text. */
export interface LineChangeRow {
  key: string; // tool_use id (Claude) / item id (Codex)
  ts: number;
  sessionId: string;
  source: UsageSource;
  filePath: string | null;
  added: number;
  removed: number;
}

/** A pull request a session opened or linked. */
export interface PrLinkRow {
  url: string; // dedup key
  ts: number;
  sessionId: string;
  source: UsageSource;
  number: number | null;
  repo: string | null;
}

/** One user turn's latency. */
export interface TurnRow {
  key: string; // Codex turn_id / Claude prompt uuid
  ts: number;
  sessionId: string;
  source: UsageSource;
  durationMs: number;
  /** Time to first token, when recorded. */
  ttftMs: number | null;
}

/** A session title record, in file order (`seq`); these records carry no timestamp. */
export interface TitleRow {
  sessionId: string;
  title: string;
  kind: 'custom' | 'ai';
  seq: number;
}

export interface CorpusRow {
  sessionId: string;
  snippets: string[];
}

export interface FileRows {
  path: string;
  source: UsageSource;
  mtimeMs: number;
  size: number;
  /** True when the file exceeded INSIGHTS_MAX_FILE_BYTES — usage rows only. */
  insightsSkipped: boolean;
  usage: UsageRow[];
  toolCalls: ToolCallRow[];
  toolResults: ToolResultRow[];
  taskSpawns: TaskSpawnRow[];
  sessions: SessionPartialRow[];
  corpus: CorpusRow[];
  // Optional so rows cached before they existed still load; merge.ts treats absent as [].
  limitHits?: LimitHitRow[];
  rateLimitSnaps?: RateLimitSnapRow[];
  lineChanges?: LineChangeRow[];
  prLinks?: PrLinkRow[];
  turns?: TurnRow[];
  titles?: TitleRow[];
}

export interface ScannedFile {
  path: string;
  source: UsageSource;
  mtimeMs: number;
  size: number;
}

// ---------------------------------------------------------------------------
// Walk — parallel per-directory. Measured at 0.06s for 2,608 files, so this has
// never been the bottleneck; it is parallel only because it costs nothing.
// ---------------------------------------------------------------------------

async function walk(dir: string, source: UsageSource, acc: string[]): Promise<void> {
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(
    dirents.map(async (d) => {
      const full = join(dir, d.name);
      if (d.isDirectory()) await walk(full, source, acc);
      else if (d.isFile() && d.name.endsWith('.jsonl') && keepScanFile(full, source)) acc.push(full);
    })
  );
}

/** Every scanned jsonl file with its stat metadata, sorted for deterministic merge order. */
export async function listScannedFiles(): Promise<ScannedFile[]> {
  const out: ScannedFile[] = [];
  for (const root of scanRoots()) {
    const paths: string[] = [];
    await walk(root.dir, root.source, paths);
    // Sort within a root so merge order (which decides "first file wins" fields
    // like projectPath and firstPrompt) is stable across runs and machines.
    paths.sort();
    for (const p of paths) out.push({ path: p, source: root.source, mtimeMs: 0, size: 0 });
  }
  await runPool(out, 32, async (f) => {
    try {
      const s = await stat(f.path);
      f.mtimeMs = s.mtimeMs;
      f.size = s.size;
    } catch {
      f.mtimeMs = -1;
      f.size = -1;
    }
  });
  return out.filter((f) => f.size >= 0);
}

/** Bounded-concurrency map. Shared by the walk, the stat sweep and the parse pass. */
export async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

// ---------------------------------------------------------------------------
// Path helpers — kept identical to the originals in scan.ts / insights-scan.ts
// ---------------------------------------------------------------------------

function decodeProjectPath(encoded: string): string {
  if (/^[A-Za-z]--/.test(encoded)) {
    const letter = encoded[0].toLowerCase();
    const rest = encoded.slice(3).replace(/--/g, '\\');
    return `${letter}:\\${rest}`;
  }
  return '/' + encoded.replace(/--/g, '/');
}

function projectPathFromFile(file: string): string {
  try {
    const parts = file.replace(/\\/g, '/').split('/');
    const projIdx = parts.lastIndexOf('projects');
    if (projIdx !== -1 && parts[projIdx + 1]) {
      return decodeProjectPath(decodeURIComponent(parts[projIdx + 1]));
    }
  } catch {
    /* keep empty */
  }
  return '';
}

function agentIdFromFileName(file: string): string | null {
  const parts = file.replace(/\\/g, '/').split('/');
  const m = parts[parts.length - 1].match(/^agent-([a-z0-9]+)\.jsonl$/);
  return m ? m[1] : null;
}

function isSubagentFile(file: string): boolean {
  return /[/\\]subagents[/\\]/.test(file);
}

function parentSessionFromPath(file: string): string {
  return file.replace(/\\/g, '/').match(/\/([^/]+)\/subagents\//)?.[1] ?? '';
}

/** `mcp__<server>__<tool>` → server. Shared with the codex parser, which names MCP calls the same way. */
export function extractMcpServer(name: string): string | null {
  const m = name.match(/^mcp__([^_]+(?:_[^_]+)*)__/);
  return m ? m[1] : null;
}

function extractFilePath(input: any): string | null {
  if (!input || typeof input !== 'object') return null;
  const fp = input.file_path ?? input.path ?? input.filePath ?? null;
  return typeof fp === 'string' ? fp : null;
}

function isGitCommitCommand(toolName: string, input: any): boolean {
  if (toolName !== 'Bash' && toolName !== 'PowerShell') return false;
  return /git\s+commit/.test(typeof input?.command === 'string' ? input.command : '');
}

function isGitPushCommand(toolName: string, input: any): boolean {
  if (toolName !== 'Bash' && toolName !== 'PowerShell') return false;
  return /git\s+push/.test(typeof input?.command === 'string' ? input.command : '');
}

export function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function attrStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** A tool_result's text: the string itself, or its text blocks concatenated. */
function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  let text = '';
  if (Array.isArray(content)) {
    for (const tb of content) {
      if (tb?.type === 'text' && typeof tb.text === 'string') text += tb.text;
    }
  }
  return text;
}

/**
 * How Claude Code words a call the permission layer refused, as opposed to one
 * that ran and failed. Anchored at the start: a failed command whose output merely
 * quotes one of these (or says "Permission denied" from the OS) must not count.
 */
const REJECTION_PATTERNS: RegExp[] = [
  /^The user doesn['’]t want to proceed with this tool use\b/, // declined at the prompt
  /^Permission for this tool use was denied\b/, // the same decline, as a subagent sees it
  /^User rejected\b/, // the toolUseResult wording of that decline
  /^Permission to use .+? has been denied\b/, // a deny rule
  /^Permission for this action was denied by the Claude Code auto mode classifier\b/,
  /^Claude requested permissions to .+ but you haven['’]t granted it yet\b/, // no prompt available
];

/**
 * Whether a tool_result is a permission rejection. Only an is_error result can be:
 * the old test ran /reject|doesn't want to proceed|denied/ over every result, so a
 * successful Read of a file that mentions "reject" counted as a rejection, and
 * those false positives outnumbered real declines by more than 30 to 1.
 */
export function isRejectedToolResult(block: any): boolean {
  if (!block || block.is_error !== true) return false;
  if (block.rejected === true) return true;
  const text = toolResultText(block.content).trimStart().replace(/^<tool_use_error>\s*/, '');
  return REJECTION_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// History-row helpers (Claude transcripts). Exported for the unit tests.
// ---------------------------------------------------------------------------

/**
 * A turn is clamped at this length. Its end is the last assistant line or tool result
 * before the next prompt, so the idle gap between turns never counts; the cap only
 * bounds a turn that sat on something for hours (a permission prompt left overnight,
 * a machine asleep mid-turn), where the gap is not work either.
 */
export const TURN_CAP_MS = 6 * 60 * 60 * 1000;

function countTextLines(s: string): number {
  if (!s) return 0;
  let n = 1;
  for (let i = s.indexOf('\n'); i !== -1; i = s.indexOf('\n', i + 1)) n++;
  return s.endsWith('\n') ? n - 1 : n;
}

/**
 * Lines added/removed by one Edit/MultiEdit/Write result (`toolUseResult`), or null
 * when the result is not a file edit. `structuredPatch` hunks carry only body lines
 * (' ', '+', '-', '\'), never '@@'/'+++' headers, so the first character decides.
 * A Write that creates a file has an empty patch; its content lines are all added.
 * Counts only: the patch text itself is never kept.
 */
export function countPatchLines(tur: any): { added: number; removed: number } | null {
  if (!tur || typeof tur !== 'object' || Array.isArray(tur)) return null;
  const patch: unknown[] | null = Array.isArray(tur.structuredPatch) ? tur.structuredPatch : null;
  const isCreate = tur.type === 'create' && typeof tur.content === 'string';
  if (!patch && !isCreate) return null;
  let added = 0;
  let removed = 0;
  for (const hunk of patch ?? []) {
    const lines = (hunk as any)?.lines;
    if (!Array.isArray(lines)) continue;
    for (const l of lines) {
      if (typeof l !== 'string') continue;
      const c = l.charCodeAt(0);
      if (c === 43) added++; // '+'
      else if (c === 45) removed++; // '-'
    }
  }
  if (isCreate && added === 0 && removed === 0) added = countTextLines(tur.content);
  return { added, removed };
}

function textLines(s: string): string[] {
  if (!s) return [];
  const lines = s.split('\n');
  if (s.endsWith('\n')) lines.pop(); // as countTextLines: a final newline starts no line
  return lines;
}

function editLineCounts(oldStr: string, newStr: string): { added: number; removed: number } {
  const a = textLines(oldStr);
  const b = textLines(newStr);
  let lead = 0;
  while (lead < a.length && lead < b.length && a[lead] === b[lead]) lead++;
  let trail = 0;
  while (
    trail < a.length - lead && trail < b.length - lead &&
    a[a.length - 1 - trail] === b[b.length - 1 - trail]
  ) trail++;
  return { added: b.length - lead - trail, removed: a.length - lead - trail };
}

/** Approximate lines an Edit/MultiEdit/Write changes, from its input: for results logged without a patch (subagents). */
export function countInputEditLines(name: string, input: any): { added: number; removed: number } | null {
  if (!input || typeof input !== 'object') return null;
  if (name === 'Write') {
    return typeof input.content === 'string' ? { added: countTextLines(input.content), removed: 0 } : null;
  }
  if (name === 'Edit') {
    return typeof input.old_string === 'string' && typeof input.new_string === 'string'
      ? editLineCounts(input.old_string, input.new_string)
      : null;
  }
  if (name === 'MultiEdit' && Array.isArray(input.edits)) {
    let added = 0;
    let removed = 0;
    for (const e of input.edits) {
      if (typeof e?.old_string !== 'string' || typeof e?.new_string !== 'string') continue;
      const c = editLineCounts(e.old_string, e.new_string);
      added += c.added;
      removed += c.removed;
    }
    return { added, removed };
  }
  return null;
}

/** `owner/repo` from a GitHub-style pull-request URL. */
function repoFromPrUrl(url: string): string | null {
  return url.match(/^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/pull\//)?.[1] ?? null;
}

/** Claude Code's own wording when a usage limit refuses a request (a `<synthetic>` assistant line). */
const LIMIT_TEXT = /\b(?:hit|reached) your (?:[\w.-]+ ){0,2}limit\b|\busage limit reached\b/i;
const NAMED_LIMIT_TEXT = /\b(?:hit|reached) your ([\w.-]+)(?: [\w.-]+)? limit\b/i;
const MODEL_FAMILY = /opus|sonnet|haiku|fable|mythos/i;

function limitKindFromType(t: unknown): LimitHitRow['kind'] | null {
  if (typeof t !== 'string') return null;
  if (t === 'five_hour') return 'session';
  if (t === 'seven_day') return 'weekly';
  if (/opus|sonnet|haiku|fable|mythos|model/i.test(t)) return 'model'; // seven_day_opus, …
  return null;
}

function limitKindFromText(text: string): LimitHitRow['kind'] {
  if (/\bsession limit\b|\b(?:5|five)[- ]hour limit\b/i.test(text)) return 'session';
  if (/\bweekly limit\b/i.test(text)) return 'weekly';
  if (/\busage limit\b/i.test(text)) return 'unknown';
  // "You've reached your Fable limit" — any other named limit is a per-model cap.
  if (NAMED_LIMIT_TEXT.test(text)) return 'model';
  return 'unknown';
}

const tzFormatters = new Map<string, Intl.DateTimeFormat>();

/** Offset of `timeZone` from UTC at instant `ts`, in ms (throws on an unknown zone). */
function tzOffsetMs(ts: number, timeZone: string): number {
  let f = tzFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    tzFormatters.set(timeZone, f);
  }
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(ts)) p[part.type] = Number(part.value);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ts / 1000) * 1000;
}

/** The first instant after `after` whose wall-clock time in `timeZone` is hour:minute; null on a bad zone. */
export function nextWallClock(after: number, hour: number, minute: number, timeZone: string): number | null {
  try {
    const local = new Date(after + tzOffsetMs(after, timeZone));
    for (let day = 0; day <= 2; day++) {
      const wall = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + day, hour, minute);
      let t = wall - tzOffsetMs(wall, timeZone);
      t = wall - tzOffsetMs(t, timeZone); // settle across a DST change
      if (t > after) return t;
    }
  } catch {
    /* unknown time zone */
  }
  return null;
}

function epochMs(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string') {
    const n = Date.parse(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

/**
 * Whether an assistant line is a request refused for a usage limit, and which one.
 * Current Claude Code flags it (`isApiErrorMessage`, `error: 'rate_limit'`, status 429,
 * `quotaLimits{rateLimitType, resetsAt (epoch s)}`); older lines only carry the
 * `<synthetic>` "You've hit your session limit · resets 4am (Europe/London)" text,
 * whose wall-clock reset is resolved against the line's own timestamp.
 * `family` names the capped model family of a per-model limit ('fable', 'opus'…).
 */
export function limitHitOf(
  obj: any,
  ts: number,
): { kind: LimitHitRow['kind']; resetsAt: number | null; family: string | null } | null {
  if (obj?.type !== 'assistant') return null;
  const ql = obj.quotaLimits && typeof obj.quotaLimits === 'object' ? obj.quotaLimits : null;
  const flagged = obj.isApiErrorMessage === true && (obj.error === 'rate_limit' || obj.apiErrorStatus === 429 || ql !== null);
  if (!flagged && obj.message?.model !== '<synthetic>') return null;
  const text = toolResultText(obj.message?.content); // an assistant message's text blocks, same shape
  // A 429 alone is not a usage limit (per-minute API limits, server load).
  if (ql === null && !LIMIT_TEXT.test(text)) return null;

  const kind = limitKindFromType(ql?.rateLimitType) ?? limitKindFromText(text);
  let family: string | null = null;
  if (kind === 'model') {
    const named = (typeof ql?.rateLimitType === 'string' ? ql.rateLimitType.match(MODEL_FAMILY)?.[0] : undefined)
      ?? text.match(NAMED_LIMIT_TEXT)?.[1];
    family = named ? named.toLowerCase() : null;
  }
  let resetsAt = epochMs(ql?.resetsAt);
  if (resetsAt === null) {
    const pipe = text.match(/limit reached\|(\d{9,13})\b/i);
    if (pipe) resetsAt = epochMs(Number(pipe[1]));
  }
  if (resetsAt === null) {
    const m = text.match(/\bresets (\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(([A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*)\)/i);
    if (m) {
      const h12 = Number(m[1]) % 12;
      const hour = m[3].toLowerCase() === 'pm' ? h12 + 12 : h12;
      resetsAt = nextWallClock(ts, hour, Number(m[2] ?? 0), m[4]);
    }
  }
  return { kind, resetsAt, family };
}

/**
 * What a user line means for turn timing:
 *  - 'prompt': starts a turn — typed input, or input Claude Code injects the same way
 *    (a scheduled task, a background-task notification, a slash command)
 *  - 'work': part of the running turn — a tool result, or the marker left when the
 *    user interrupts it (the turn ran until then)
 *  - null: neither — meta lines, compaction summaries, a local command's echoed
 *    output. These can be written long after a turn ended, so they never extend one.
 *
 * `dequeued` is true when this is the first user line after a queue-operation `dequeue`
 * (attachments may sit between, an assistant line may not): that is Claude Code
 * delivering queued input, which starts a turn even when it is flagged isMeta (a
 * scheduled wake-up, a message from another session). Without this, a turn cut off by
 * a limit refusal swallowed the idle hours until the next delivered input.
 */
export function userTurnRole(obj: any, dequeued = false): 'prompt' | 'work' | null {
  if (obj?.type !== 'user' || obj.message?.role !== 'user') return null;
  const content = obj.message.content;
  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    for (const b of content) {
      if (b?.type === 'tool_result') return 'work';
      if (!text && b?.type === 'text' && typeof b.text === 'string') text = b.text;
    }
  } else {
    return null;
  }
  if (obj.isCompactSummary === true || obj.isVisibleInTranscriptOnly === true) return null;
  if (obj.isMeta === true && !dequeued) return null;
  const t = text.trimStart();
  if (t.startsWith('[Request interrupted')) return 'work';
  return /^<local-command-(?:stdout|stderr|caveat)>/.test(t) ? null : 'prompt';
}

// ---------------------------------------------------------------------------
// Per-file parse
// ---------------------------------------------------------------------------

/**
 * Parse one JSONL file into flat rows.
 *
 * Two behaviours are deliberate:
 *  - usage rows come from every file; insight rows only from files up to
 *    INSIGHTS_MAX_FILE_BYTES (the insights-scan.ts this replaces stopped at 5 MB)
 *  - cowork transcripts get an empty projectPath, because the path they encode is
 *    sandbox-internal and meaningless on the host
 *
 * Codex rollouts are not Claude transcripts at all and take their own parser.
 */
export async function parseFileRows(file: ScannedFile): Promise<FileRows> {
  if (file.source === 'codex') return parseCodexFileRows(file);

  const { path, source, mtimeMs, size } = file;
  const insightsSkipped = size > INSIGHTS_MAX_FILE_BYTES;

  // History rows. Limit hits come from every file (merge.ts reads them even for files
  // over INSIGHTS_MAX_FILE_BYTES); the rest only from insight-eligible files.
  const limitHits: LimitHitRow[] = [];
  const lineChanges: LineChangeRow[] = [];
  const prLinks: PrLinkRow[] = [];
  const turns: TurnRow[] = [];
  const titles: TitleRow[] = [];

  const rows: FileRows = {
    path, source, mtimeMs, size, insightsSkipped,
    usage: [], toolCalls: [], toolResults: [], taskSpawns: [], sessions: [], corpus: [],
    limitHits, lineChanges, prLinks, turns, titles,
  };

  const projectPath = source === 'cowork' ? '' : projectPathFromFile(path);
  const fileIsSidechain = isSubagentFile(path);
  const parentFromPath = parentSessionFromPath(path);
  const agentId = agentIdFromFileName(path);

  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return rows;
  }

  // Within-file dedup. Cross-file dedup cannot happen here — it belongs in merge.ts.
  const usageByKey = new Map<string, number>(); // dedupKey -> index into rows.usage
  const seenToolIds = new Set<string>();
  const seenTaskIds = new Set<string>();
  const sessions = new Map<string, SessionPartialRow>();
  const corpus = new Map<string, { snippets: string[]; len: number }>();
  const assistantKeys = new Map<string, Set<string>>(); // sessionId -> distinct keys
  let keylessAssistant = 0;
  // History-row identities already emitted from this file (merge.ts dedups across files).
  const seenLimitKeys = new Set<string>();
  const seenLineChangeIds = new Set<string>();
  const seenPrUrls = new Set<string>();
  const seenPromptKeys = new Set<string>();
  const lastModel = new Map<string, string>(); // sessionId -> last real model, for limit hits
  // tool_use id -> lines estimated from an edit's input, used when its result has no patch.
  const inputEdits = new Map<string, { filePath: string | null; added: number; removed: number }>();

  // Turn timing: main-session files only (a subagent's prompts are its parent's tool
  // calls). A turn runs from a prompt to the last assistant line or tool result before
  // the next prompt; lines older than the prompt (history a resumed transcript repeats
  // out of order) or from another session never extend it.
  const trackTurns = !fileIsSidechain && !insightsSkipped;
  let turn: { key: string; ts: number; sessionId: string; endTs: number; firstReplyTs: number | null } | null = null;
  let dequeued = false; // the next user line is queued input being delivered
  const finishTurn = () => {
    // A prompt nothing answered (a local slash command, a request refused for a
    // limit) is not a turn.
    if (turn && turn.firstReplyTs !== null) {
      turns.push({
        key: turn.key, ts: turn.ts, sessionId: turn.sessionId, source,
        durationMs: Math.min(turn.endTs - turn.ts, TURN_CAP_MS),
        ttftMs: Math.min(turn.firstReplyTs - turn.ts, TURN_CAP_MS),
      });
    }
    turn = null;
  };

  const addPr = (url: unknown, prNumber: unknown, repo: unknown, ts: number, sessionId: string) => {
    if (typeof url !== 'string' || !url || seenPrUrls.has(url)) return;
    seenPrUrls.add(url);
    prLinks.push({
      url, ts, sessionId, source,
      number: typeof prNumber === 'number' && Number.isFinite(prNumber) ? prNumber : null,
      repo: typeof repo === 'string' && repo ? repo : repoFromPrUrl(url),
    });
  };

  const sessionRow = (sessionId: string, ts: number, gitBranch: string): SessionPartialRow => {
    let sm = sessions.get(sessionId);
    if (!sm) {
      sm = {
        sessionId, fileIsSidechain, firstTs: ts, lastTs: ts,
        turns: 0, compactions: 0, errorCount: 0, rejectionCount: 0,
        firstPrompt: '', gitBranch, projectPath, file: path, agentId, source,
        assistantKeys: [], gitCommitIds: [], gitPushIds: [], nonErrorResultIds: [],
        cwd: '', client: '', clientVersion: '',
      };
      sessions.set(sessionId, sm);
    }
    if (ts < sm.firstTs) sm.firstTs = ts;
    if (ts > sm.lastTs) sm.lastTs = ts;
    if (gitBranch && !sm.gitBranch) sm.gitBranch = gitBranch;
    return sm;
  };

  const addCorpus = (sessionId: string, snippet: string) => {
    let c = corpus.get(sessionId);
    if (!c) { c = { snippets: [], len: 0 }; corpus.set(sessionId, c); }
    // The 20 KB per-session cap is applied again globally in merge.ts; keeping it
    // here too bounds memory for a single huge transcript.
    if (c.len < CORPUS_CAP_BYTES) { c.snippets.push(snippet); c.len += snippet.length + 1; }
  };

  const lines = text.split('\n');
  for (let seq = 0; seq < lines.length; seq++) {
    const line = lines[seq];
    if (line.length < 2) continue;

    // Fast path: when only usage rows are wanted, skip lines that cannot be an
    // assistant message without paying for a full parse. Measured 2x on the
    // usage-only corpus. Files that also feed insights need every line parsed.
    if (insightsSkipped && line.indexOf('"assistant"') === -1) continue;

    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    // Session titles carry no timestamp, so they are read before the timestamp gate.
    // `seq` (line order) is what lets merge.ts pick the latest one.
    if (obj.type === 'custom-title' || obj.type === 'ai-title') {
      const custom = obj.type === 'custom-title';
      const title = custom ? obj.customTitle : obj.aiTitle;
      if (!insightsSkipped && typeof title === 'string' && title.trim() && typeof obj.sessionId === 'string' && obj.sessionId) {
        titles.push({ sessionId: obj.sessionId, title: title.trim().slice(0, 200), kind: custom ? 'custom' : 'ai', seq });
      }
      continue;
    }

    const ts = Date.parse(obj.timestamp ?? '');
    if (Number.isNaN(ts)) continue;

    const sessionId: string = obj.sessionId ?? obj.session_id ?? '';
    const gitBranch: string = typeof obj.gitBranch === 'string' ? obj.gitBranch : '';

    // ---- usage rows (all files) ----
    if (obj.type === 'assistant' && obj.message?.usage) {
      const usage = obj.message.usage;
      const dedupKey = `${obj.requestId ?? ''}:${obj.message?.id ?? ''}`;

      const tools: string[] = [];
      const content = obj.message?.content;
      if (Array.isArray(content)) {
        for (const b of content) {
          if (b?.type === 'tool_use' && typeof b.name === 'string') tools.push(b.name);
        }
      }

      const row: UsageRow = {
        dedupKey, ts, sessionId,
        model: obj.message?.model ?? 'unknown',
        inputTokens: num(usage.input_tokens),
        outputTokens: num(usage.output_tokens),
        cacheCreateTokens: num(usage.cache_creation_input_tokens),
        cacheReadTokens: num(usage.cache_read_input_tokens),
        tools,
        isSidechain: fileIsSidechain || obj.isSidechain === true,
        rootSessionId: fileIsSidechain && parentFromPath ? parentFromPath : sessionId,
        attributionAgent: attrStr(obj.attributionAgent),
        attributionSkill: attrStr(obj.attributionSkill),
        attributionMcpServer: attrStr(obj.attributionMcpServer),
        attributionPlugin: attrStr(obj.attributionPlugin),
        projectPathRaw: source === 'cowork' ? '' : projectPathFromFile(path),
        gitBranch,
        source,
        effort: attrStr(obj.effort),
        // Reported only by recent Claude Code (Aug 2026 on): absent is unknown, not zero.
        reasoningTokens: Number.isFinite(usage.output_tokens_details?.thinking_tokens)
          ? usage.output_tokens_details.thinking_tokens
          : null,
      };

      // Keep-max on effective tokens: early streaming duplicates carry placeholder
      // usage, so first-seen is the wrong winner (see scan.ts:234-236).
      if (dedupKey !== ':') {
        const idx = usageByKey.get(dedupKey);
        if (idx !== undefined) {
          const prev = rows.usage[idx];
          const prevEff = prev.inputTokens + prev.outputTokens + prev.cacheCreateTokens;
          const nextEff = row.inputTokens + row.outputTokens + row.cacheCreateTokens;
          if (nextEff > prevEff) rows.usage[idx] = row;
        } else {
          usageByKey.set(dedupKey, rows.usage.length);
          rows.usage.push(row);
        }
      } else {
        rows.usage.push(row);
      }
    }

    // ---- limit hits (all files) ----
    if (obj.type === 'assistant') {
      const model = obj.message?.model;
      if (typeof model === 'string' && model !== '<synthetic>') lastModel.set(sessionId, model);
      const hit = limitHitOf(obj, ts);
      if (hit) {
        const key = typeof obj.uuid === 'string' && obj.uuid ? obj.uuid : `${sessionId}|${ts}`;
        if (!seenLimitKeys.has(key)) {
          seenLimitKeys.add(key);
          // The refusal itself is a `<synthetic>` line; the model it refused is the one
          // the session was last answered by — unless a per-model cap names another family.
          const last = lastModel.get(sessionId) ?? '';
          limitHits.push({
            key, ts, sessionId, source, kind: hit.kind,
            model: hit.family && !last.toLowerCase().includes(hit.family) ? hit.family : last,
            resetsAt: hit.resetsAt,
          });
        }
      }
    }

    if (insightsSkipped) continue;

    // ---- insight rows (files <= INSIGHTS_MAX_FILE_BYTES only) ----
    const sm = sessionRow(sessionId, ts, gitBranch);
    // First value wins. The cwd is a real host path only for Claude Code; a Cowork
    // cwd is inside its sandbox, like its projectPath.
    if (!sm.cwd && source === 'code' && typeof obj.cwd === 'string') sm.cwd = obj.cwd;
    if (!sm.client && typeof obj.entrypoint === 'string') sm.client = obj.entrypoint;
    if (!sm.clientVersion && typeof obj.version === 'string') sm.clientVersion = obj.version;

    if (trackTurns && obj.isSidechain !== true) {
      if (obj.type === 'queue-operation') {
        if (obj.operation === 'dequeue') dequeued = true;
      } else if (obj.type === 'assistant') {
        const synthetic = obj.message?.model === '<synthetic>';
        // Only a refusal or API error ends a turn; other synthetic lines can come days later.
        const extendsTurn = !synthetic || obj.isApiErrorMessage === true;
        if (extendsTurn) dequeued = false;
        if (turn && turn.sessionId === sessionId && ts >= turn.ts) {
          if (extendsTurn && ts > turn.endTs) turn.endTs = ts;
          if (!synthetic && (turn.firstReplyTs === null || ts < turn.firstReplyTs)) turn.firstReplyTs = ts;
        }
      } else if (obj.type === 'user') {
        const role = userTurnRole(obj, dequeued);
        dequeued = false;
        const key = typeof obj.uuid === 'string' ? obj.uuid : '';
        // A prompt repeated in the same file (resumed history) is not a new turn.
        if (role === 'prompt' && key && !seenPromptKeys.has(key)) {
          seenPromptKeys.add(key);
          finishTurn();
          turn = { key, ts, sessionId, endTs: ts, firstReplyTs: null };
        } else if (role === 'work' && turn && turn.sessionId === sessionId && ts > turn.endTs) {
          turn.endTs = ts;
        }
      }
    }

    if (obj.type === 'summary') {
      sm.compactions++;
      continue;
    }

    if (obj.type === 'pr-link') {
      addPr(obj.prUrl, obj.prNumber, obj.prRepository, ts, sessionId);
      continue;
    }

    if (obj.type === 'user' && obj.message?.role === 'user') {
      sm.turns++;
      const content = obj.message.content;
      let resultId = ''; // the line's tool_result, which toolUseResult describes
      const succeeded: string[] = [];

      const handleText = (t: string) => {
        if (/continued from a previous conversation/i.test(t)) sm.compactions++;
        if (!sm.firstPrompt) {
          const trimmed = t.trim();
          if (trimmed && !trimmed.startsWith('<')) sm.firstPrompt = trimmed.slice(0, 200);
        }
        addCorpus(sessionId, t.slice(0, 200));
      };

      if (typeof content === 'string') {
        handleText(content);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (!block || typeof block !== 'object') continue;

          if (block.type === 'text' && typeof block.text === 'string') handleText(block.text);

          if (block.type === 'tool_result') {
            const toolId: string = block.tool_use_id ?? '';
            if (!resultId && typeof toolId === 'string') resultId = toolId;
            const isError: boolean = block.is_error === true;
            const rejected = isRejectedToolResult(block);

            let errorText = '';
            if (isError) {
              if (typeof block.content === 'string') {
                errorText = block.content.slice(0, 200);
              } else if (Array.isArray(block.content)) {
                const tb = block.content.find((b: any) => b?.type === 'text');
                if (tb?.text) errorText = String(tb.text).slice(0, 200);
              }
            }

            if (isError) sm.errorCount++;
            if (rejected) sm.rejectionCount++;
            if (!isError) sm.nonErrorResultIds.push(toolId);
            if (!isError && !rejected && toolId) succeeded.push(toolId);

            const resultText = toolResultText(block.content);
            const agentIdMatch = resultText ? resultText.match(/agentId:\s*([a-z0-9]+)/) : null;

            rows.toolResults.push({
              toolId, sessionId, isError, rejected, errorText,
              agentIdFromResult: agentIdMatch ? agentIdMatch[1] : null,
            });
          }
        }
      }

      // Structured side of a tool result: file edits and git operations. Keyed by the
      // tool_use id, since a resumed transcript repeats the same result in a new file.
      const tur = obj.toolUseResult;
      if (tur && typeof tur === 'object' && !Array.isArray(tur)) {
        const change = resultId ? countPatchLines(tur) : null;
        if (change && !seenLineChangeIds.has(resultId)) {
          seenLineChangeIds.add(resultId);
          lineChanges.push({
            key: resultId, ts, sessionId, source,
            filePath: typeof tur.filePath === 'string' ? tur.filePath : null,
            added: change.added, removed: change.removed,
          });
        }
        const pr = tur.gitOperation?.pr;
        if (pr && typeof pr === 'object') addPr(pr.url, pr.number, null, ts, sessionId);
      }
      for (const id of succeeded) {
        const est = inputEdits.get(id);
        if (!est || seenLineChangeIds.has(id)) continue;
        seenLineChangeIds.add(id);
        lineChanges.push({ key: id, ts, sessionId, source, ...est });
      }
      continue;
    }

    if (obj.type === 'assistant' && obj.message?.role === 'assistant') {
      // assistantMsgs must count distinct message identities, not lines: streaming
      // retries repeat the same message 3x on average. Keyless lines cannot be
      // deduped, so they are counted individually.
      const key = `${obj.requestId ?? ''}:${obj.message?.id ?? ''}`;
      if (key === ':') {
        keylessAssistant++;
      } else {
        let set = assistantKeys.get(sessionId);
        if (!set) { set = new Set(); assistantKeys.set(sessionId, set); }
        set.add(key);
      }

      const content = obj.message?.content;
      if (!Array.isArray(content)) continue;

      for (const block of content) {
        if (!block || block.type !== 'tool_use') continue;
        const toolName: string = block.name ?? '';
        const toolId: string = block.id ?? '';
        const toolInput = block.input ?? {};

        if (toolId && !inputEdits.has(toolId)) {
          const est = countInputEditLines(toolName, toolInput);
          if (est) inputEdits.set(toolId, { filePath: extractFilePath(toolInput), ...est });
        }

        // Dedup by tool_use id, NOT by message key. Only 10,173 of 45,420 distinct
        // tool ids appear on the first line for a key — the earlier lines are
        // streaming placeholders whose content arrives later. Skipping duplicate
        // *messages* would silently drop 78% of tool calls.
        if (toolId && seenToolIds.has(toolId)) continue;
        if (toolId) seenToolIds.add(toolId);

        rows.toolCalls.push({
          toolId, ts, sessionId, name: toolName,
          isSidechain: fileIsSidechain,
          mcpServer: extractMcpServer(toolName),
          filePath: extractFilePath(toolInput),
          gitBranch, projectPath, source,
        });

        if (toolName === 'Agent' || toolName === 'Task') {
          if (!toolId || !seenTaskIds.has(toolId)) {
            if (toolId) seenTaskIds.add(toolId);
            rows.taskSpawns.push({
              toolId, ts, sessionId,
              subagentType: toolInput.subagent_type ?? toolInput.agentType ?? 'unknown',
              model: toolInput.model ?? null,
              description: String(toolInput.description ?? '').slice(0, 200),
              gitBranch, projectPath, source,
            });
          }
        }

        if (isGitCommitCommand(toolName, toolInput)) sm.gitCommitIds.push(toolId);
        if (isGitPushCommand(toolName, toolInput)) sm.gitPushIds.push(toolId);
      }
    }
  }
  finishTurn();

  for (const [sessionId, set] of assistantKeys) {
    const sm = sessions.get(sessionId);
    if (sm) sm.assistantKeys = [...set];
  }
  // Attribute keyless assistant lines to the file's first session so the count is
  // preserved without pretending they have an identity.
  if (keylessAssistant > 0) {
    const first = sessions.values().next().value;
    if (first) {
      for (let i = 0; i < keylessAssistant; i++) first.assistantKeys.push(`\0keyless:${path}:${i}`);
    }
  }

  rows.sessions = [...sessions.values()];
  rows.corpus = [...corpus.entries()].map(([sessionId, c]) => ({ sessionId, snippets: c.snippets }));
  return rows;
}

/** Parse many files with bounded concurrency, preserving input order in the output. */
export async function parseFiles(files: ScannedFile[]): Promise<FileRows[]> {
  const out = new Array<FileRows>(files.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(PARSE_CONCURRENCY, files.length) }, async () => {
    while (next < files.length) {
      const i = next++;
      out[i] = await parseFileRows(files[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
