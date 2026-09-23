/**
 * subagents-live.ts
 * getLiveSubagents() with 3s TTL cache — the Claude Code feed of the Agents tab;
 * codex-agents-live.ts shares its LiveSubagentsData shape and state machine (mainAgentState).
 *
 * Detects running subagents by:
 *   (a) Agent/Task tool_use blocks in files modified within last 30 min with no matching result
 *   (b) sidechain files modified recently → active workers
 *   (c) linking a sidechain to its spawn by .meta.json's toolUseId, else agentId, else prompt prefix
 *   (d) Workflow agents (no spawn record) attach to their session by path, labelled from .meta.json
 */

import { open, readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { claudeDir } from './scan.ts';
import { isRejectedToolResult, limitHitOf, runPool, userTurnRole } from './scan-pass.ts';

/** 'finished': done, or a main idle (see yourTurn); 'running': actively working; 'waiting': INFERRED (no explicit marker) from an unresolved tool_use, a rejected result, or an API-error/usage-limit turn end — biased toward 'running' when uncertain. */
export type AgentTrafficStatus = 'finished' | 'running' | 'waiting';

export interface LiveSubagent {
  key: string;
  /** Parent session file path — links this subagent to its MainAgent.key. '' if orphaned. */
  parentKey: string;
  name: string;
  description: string;
  model: string;
  startedAt: number;
  lastActivity: number;
  effectiveTokens: number;
  /** Working directory (full path; the UI shortens it). */
  project: string;
  status: 'running';
  traffic: AgentTrafficStatus;
}

export interface RecentlyCompletedSubagent {
  key: string;
  /** Parent session file path — links this subagent to its MainAgent.key. '' if orphaned. */
  parentKey: string;
  name: string;
  description: string;
  model: string;
  completedAt: number;
  /** True for run_in_background tasks — kept in the list far longer (mirrors the CLI panel). */
  background: boolean;
  effectiveTokens: number;
  project: string;
}

export interface MainAgent {
  key: string;
  title: string;
  /** Working directory (full path, from the transcript's `cwd`; the UI shortens it). */
  project: string;
  gitBranch: string;
  model: string;
  startedAt: number;
  lastActivity: number;
  effectiveTokens: number;
  /** True when the session's own transcript is freshly active (not just hosting subagents). */
  active: boolean;
  /** True when the transcript is idle but the session still has running subagents. */
  delegating: boolean;
  /** The last turn finished normally and the session is idle on the user — a soft "your turn", never red/alert; mutually exclusive with waiting/active/delegating. */
  yourTurn: boolean;
  status: 'running';
  traffic: AgentTrafficStatus;
}

export interface LiveCounts {
  /** Running subagents + main sessions working on their own or delegating (the header lamp and sidebar badge). */
  running: number;
  waiting: number;
  /** Recently finished subagents. */
  finished: number;
  /** Main sessions idle on the user after a finished turn. */
  yourTurn: number;
}

export interface LiveSubagentsData {
  running: LiveSubagent[];
  recentlyCompleted: RecentlyCompletedSubagent[];
  mainAgents: MainAgent[];
  /** Traffic-light tallies for badges/alerts (finished = recentlyCompleted). */
  counts: LiveCounts;
}

// Main-session state machine — shared with codex-agents-live.ts

/** A session pulses "active" while written to this recently … */
export const MAIN_ACTIVE = 30_000;
/** … and stays listed, dimmed, for this long after its last write. */
export const MAIN_LINGER = 60_000;
/** Waiting / your-turn / running-subagent signals only count while the session wrote this recently. */
export const ACTIVE_WINDOW = 5 * 60_000;

export interface MainSignals {
  /** ms since the session last wrote anything. */
  sinceWrite: number;
  /** Working on its own right now: a fresh write, or (Codex) an open turn. */
  selfActive: boolean;
  /** Running subagents this session owns. */
  runningChildren: number;
  /** Something only the user can resolve: a pending approval, a rejected/declined action, a failed turn. */
  needsUser: boolean;
  /** The last turn finished normally (or the user interrupted it), so the next move is the user's. */
  turnEnded: boolean;
}

export interface MainState {
  /** Whether the session is shown at all. */
  listed: boolean;
  active: boolean;
  delegating: boolean;
  yourTurn: boolean;
  traffic: AgentTrafficStatus;
}

/** waiting (RED): needsUser, quiet MAIN_ACTIVE..ACTIVE_WINDOW, not delegating; yourTurn (soft): turn ended normally in that same quiet window; else active/delegating while working, else idle until MAIN_LINGER. */
export function mainAgentState(s: MainSignals): MainState {
  const quiet = s.sinceWrite >= MAIN_ACTIVE;
  const recent = s.sinceWrite < ACTIVE_WINDOW;
  const waiting = s.needsUser && quiet && recent && s.runningChildren === 0;
  const active = s.selfActive && !waiting;
  const delegating = !active && !waiting && s.runningChildren > 0;
  const yourTurn = !waiting && !active && !delegating && s.turnEnded && quiet && recent;
  const listed = active || delegating || waiting || yourTurn || s.sinceWrite < MAIN_LINGER;
  const traffic: AgentTrafficStatus = waiting ? 'waiting' : active || delegating ? 'running' : 'finished';
  return { listed, active, delegating, yourTurn, traffic };
}

/** `running` counts what is actually working (subagents + active/delegating mains), so the header lamp and sidebar badge agree — a merely-listed idle main is not running. */
export function tallyCounts(
  running: readonly unknown[],
  completed: readonly unknown[],
  mains: readonly Pick<MainAgent, 'active' | 'delegating' | 'traffic' | 'yourTurn'>[],
): LiveCounts {
  return {
    running: running.length + mains.filter((m) => m.active || m.delegating).length,
    waiting: mains.filter((m) => m.traffic === 'waiting').length,
    finished: completed.length,
    yourTurn: mains.filter((m) => m.yourTurn).length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectsDir(): string {
  return join(claudeDir(), 'projects');
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

interface FileStat {
  path: string;
  mtime: number;
  size: number;
}

const STAT_CONCURRENCY = 16;
const READ_CONCURRENCY = 8;
const READ_CHUNK = 1024 * 1024;

async function walkJsonl(dir: string): Promise<string[]> {
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const parts = await Promise.all(
    dirents.map(async (d) => {
      const full = join(dir, d.name);
      if (d.isDirectory()) return walkJsonl(full);
      return d.isFile() && d.name.endsWith('.jsonl') ? [full] : [];
    }),
  );
  return parts.flat();
}

/** Every .jsonl under `dir` in directory-walk order, stat'ed through a bounded pool. */
async function listJsonl(dir: string): Promise<FileStat[]> {
  const out: FileStat[] = (await walkJsonl(dir)).map((path) => ({ path, mtime: 0, size: -1 }));
  await runPool(out, STAT_CONCURRENCY, async (f) => {
    try {
      const s = await stat(f.path);
      f.mtime = s.mtimeMs;
      f.size = s.size;
    } catch { /* vanished — dropped below */ }
  });
  return out.filter((f) => f.size >= 0);
}

interface LineParser<R> {
  /** Feed one line; false when it is not valid JSON. */
  push(line: string): boolean;
  /** The result so far, without disturbing the state later lines build on. */
  finish(): R;
}

interface TailEntry<R> {
  size: number;
  mtime: number;
  /** Bytes fed to the parser: every complete line, plus a last unterminated one only if it parsed. */
  offset: number;
  parser: LineParser<R>;
}

/** Feeds the lines in [from, size) to `push`, split on 0x0A bytes — never readline (see CLAUDE.md, "Split lines on \n"). */
async function readLinesFrom(path: string, from: number, size: number, push: (line: string) => boolean): Promise<number> {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(Math.min(READ_CHUNK, Math.max(1, size - from)));
    let pos = from;
    let offset = from;
    let carry: Buffer[] = [];
    while (pos < size) {
      const { bytesRead } = await fh.read(buf, 0, Math.min(buf.length, size - pos), pos);
      if (bytesRead === 0) break;
      const chunk = buf.subarray(0, bytesRead);
      let start = 0;
      for (let nl = chunk.indexOf(0x0a); nl !== -1; nl = chunk.indexOf(0x0a, start)) {
        const piece = chunk.subarray(start, nl);
        push((carry.length ? Buffer.concat([...carry, piece]) : piece).toString('utf8'));
        carry = [];
        start = nl + 1;
        offset = pos + start;
      }
      if (start < bytesRead) carry.push(Buffer.from(chunk.subarray(start)));
      pos += bytesRead;
    }
    // A last line still being written does not parse; it is read again once it grows.
    if (carry.length && push(Buffer.concat(carry).toString('utf8'))) offset = pos;
    return offset;
  } finally {
    await fh.close();
  }
}

/** Transcripts are append-only: a grown file feeds its cached parser only the new bytes; a shrunk or rewritten one starts over. */
async function tailParse<R>(cache: Map<string, TailEntry<R>>, f: FileStat, create: () => LineParser<R>): Promise<R> {
  const prev = cache.get(f.path);
  if (prev && prev.size === f.size && prev.mtime === f.mtime) return prev.parser.finish();
  const entry = prev && f.size > prev.size ? prev : { size: 0, mtime: 0, offset: 0, parser: create() };
  cache.delete(f.path); // a read that fails part-way must not leave a half-fed parser behind
  entry.offset = await readLinesFrom(f.path, entry.offset, f.size, (line) => entry.parser.push(line));
  entry.size = f.size;
  entry.mtime = f.mtime;
  cache.set(f.path, entry);
  return entry.parser.finish();
}

function evictExcept<R>(cache: Map<string, TailEntry<R>>, keep: ReadonlySet<string>): void {
  for (const path of cache.keys()) if (!keep.has(path)) cache.delete(path);
}

/** Fallback working directory decoded from the encoded project folder name (lossy: '-' vs separators). */
function projectPathFromFile(file: string): string {
  try {
    const parts = file.replace(/\\/g, '/').split('/');
    const projIdx = parts.lastIndexOf('projects');
    if (projIdx !== -1 && parts[projIdx + 1]) {
      const encoded = decodeURIComponent(parts[projIdx + 1]);
      if (/^[A-Za-z]--/.test(encoded)) {
        const letter = encoded[0].toLowerCase();
        const rest = encoded.slice(3).replace(/--/g, '\\');
        return `${letter}:\\${rest}`;
      }
      return '/' + encoded.replace(/--/g, '/');
    }
  } catch { /* keep empty */ }
  return '';
}

function projectNameFromPath(projectPath: string): string {
  return projectPath.split(/[\\\/]/).filter(Boolean).pop() ?? projectPath;
}

function agentIdFromFileName(file: string): string | undefined {
  const m = basename(file).match(/^agent-([a-z0-9]+)\.jsonl$/);
  return m ? m[1] : undefined;
}

const SUBAGENTS_SEG = /[\\/]subagents[\\/]/;

/** Whether a path is a sidechain transcript (under a session's subagents/ folder). */
export function isSidechainPath(p: string): boolean {
  return SUBAGENTS_SEG.test(p);
}

/** The main transcript a sidechain belongs to: `<proj>/<session>/subagents/[...]/agent-<id>.jsonl` → `<proj>/<session>.jsonl`. */
export function sessionFileOfSidechain(p: string): string {
  const m = SUBAGENTS_SEG.exec(p);
  return m ? p.slice(0, m.index) + '.jsonl' : '';
}

/** The workflow run id when a sidechain belongs to a Workflow run (`…/subagents/workflows/wf_<id>/agent-*.jsonl`). */
export function workflowRunOf(p: string): string {
  const m = /[\\/]subagents[\\/]workflows[\\/](wf_[^\\/]+)[\\/]agent-[^\\/]+\.jsonl$/.exec(p);
  return m ? m[1] : '';
}

/** Tools whose dangling tool_use is delegation (its result arrives when the work finishes), not a permission prompt. */
const DELEGATION_TOOLS = new Set(['Agent', 'Task', 'Workflow']);

/** Assistant stop reasons that end a turn (anything but a tool call the harness will run next). */
const TURN_ENDING_STOPS = new Set(['end_turn', 'stop_sequence', 'max_tokens', 'refusal']);

interface SpawnRec {
  id: string;
  description: string;
  subagentType: string;
  model: string | null;
  promptPrefix: string;
  ts: number;
}

interface ResultRec {
  toolUseId: string;
  ts: number;
  agentId: string | null;
  /** Background launches return a tool_result immediately — it is NOT a completion. */
  isAsyncLaunch: boolean;
}

export interface MainInfo {
  title: string;
  /** A user rename (`custom-title`) — beats the generated `ai-title`. */
  customTitle: string;
  gitBranch: string;
  /** Last `cwd` the transcript recorded — the real working directory. */
  cwd: string;
  model: string;
  effectiveTokens: number;
  firstTs: number;
  lastTs: number;
  hasAssistant: boolean;
  /** ts of the most recent assistant tool_use (any tool) — for waiting inference. */
  lastToolUseTs: number;
  /** ts of the most recent NON-delegation tool_use (excludes Agent/Task/Workflow).
   *  Drives pendingTool so a dangling delegation is never read as a permission prompt. */
  lastNonDelegationToolUseTs: number;
  /** ts of the most recent tool_result resolving a tool_use. */
  lastToolResultTs: number;
  /** Whether that most recent tool_result was rejected by the user. */
  lastResultIsError: boolean;
  /** ts of the most recent assistant line, and how it ended. */
  lastAssistantTs: number;
  lastAssistantEnded: boolean;
  /** The most recent assistant line is an API error / usage-limit refusal. */
  lastAssistantIsError: boolean;
  /** ts of the most recent user prompt (typed or injected input that starts a turn). */
  lastPromptTs: number;
  /** ts of the most recent "[Request interrupted by user…]" marker. */
  lastInterruptTs: number;
}

export interface ParsedMain {
  spawns: SpawnRec[];
  results: Map<string, ResultRec>;
  /** Background-agent completions arrive later as <task-notification> user entries. */
  notifications: Array<{ agentId: string; ts: number }>;
  main: MainInfo;
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  for (const b of content) if (b?.type === 'text' && typeof b.text === 'string') return b.text;
  return '';
}

/** Parse a main transcript's lines (exported for the unit tests). */
export function parseMainLines(lines: Iterable<string>): ParsedMain {
  const p = createMainParser();
  for (const l of lines) p.push(l);
  return p.finish();
}

/** Line-at-a-time main-transcript parser, so a 50 MB transcript is never held in memory whole. */
function createMainParser(): LineParser<ParsedMain> {
  const spawns: SpawnRec[] = [];
  const results = new Map<string, ResultRec>();
  const notifications: Array<{ agentId: string; ts: number }> = [];
  const main: MainInfo = {
    title: '',
    customTitle: '',
    gitBranch: '',
    cwd: '',
    model: 'unknown',
    effectiveTokens: 0,
    firstTs: Infinity,
    lastTs: 0,
    hasAssistant: false,
    lastToolUseTs: 0,
    lastNonDelegationToolUseTs: 0,
    lastToolResultTs: 0,
    lastResultIsError: false,
    lastAssistantTs: 0,
    lastAssistantEnded: false,
    lastAssistantIsError: false,
    lastPromptTs: 0,
    lastInterruptTs: 0,
  };
  // Same keep-max dedup rule as scan.ts — streaming writes duplicate usage rows.
  const usageByKey = new Map<string, number>();
  let keylessTokens = 0;
  let dequeued = false;

  const push = (line: string): boolean => {
    if (!line || line.length < 2) return false;
    let obj: any;
    try { obj = JSON.parse(line); } catch { return false; }

    // Title records carry no timestamp — read before the timestamp skip; last wins.
    if (obj.type === 'ai-title' && typeof obj.aiTitle === 'string' && obj.aiTitle) {
      main.title = obj.aiTitle;
      return true;
    }
    if (obj.type === 'custom-title' && typeof obj.customTitle === 'string' && obj.customTitle) {
      main.customTitle = obj.customTitle;
      return true;
    }

    const ts = Date.parse(obj.timestamp ?? '');
    if (Number.isNaN(ts)) return true;
    if (ts < main.firstTs) main.firstTs = ts;
    if (ts > main.lastTs) main.lastTs = ts;
    if (typeof obj.gitBranch === 'string' && obj.gitBranch) main.gitBranch = obj.gitBranch;
    if (typeof obj.cwd === 'string' && obj.cwd) main.cwd = obj.cwd;
    if (!main.title && typeof obj.slug === 'string' && obj.slug) main.title = obj.slug;

    // Background completions are enqueued instantly as queue-operation entries,
    // before the same text lands as a user message on the next turn.
    if (obj.type === 'queue-operation') {
      if (obj.operation === 'dequeue') dequeued = true;
      if (typeof obj.content === 'string') {
        const m = obj.content.match(/<task-id>([a-z0-9]+)<\/task-id>[\s\S]*?<status>completed<\/status>/);
        if (m) notifications.push({ agentId: m[1], ts });
      }
      return true;
    }

    if (obj.type === 'assistant') {
      dequeued = false;
      if (ts >= main.lastAssistantTs) {
        main.lastAssistantTs = ts;
        const stop = obj.message?.stop_reason;
        main.lastAssistantEnded = typeof stop === 'string' && TURN_ENDING_STOPS.has(stop);
        main.lastAssistantIsError = obj.isApiErrorMessage === true || limitHitOf(obj, ts) !== null;
      }
    }

    if (obj.type === 'assistant' && obj.message?.usage) {
      main.hasAssistant = true;
      const u = obj.message.usage;
      const eff = num(u.input_tokens) + num(u.output_tokens) + num(u.cache_creation_input_tokens);
      const key = `${obj.requestId ?? ''}:${obj.message?.id ?? ''}`;
      if (key !== ':') {
        const prev = usageByKey.get(key) ?? 0;
        if (eff > prev) usageByKey.set(key, eff);
      } else {
        keylessTokens += eff;
      }
      if (obj.message?.model && obj.message.model !== '<synthetic>') main.model = obj.message.model;
    }

    if (obj.type === 'assistant' && Array.isArray(obj.message?.content)) {
      for (const block of obj.message.content) {
        if (block?.type === 'tool_use') {
          if (ts > main.lastToolUseTs) main.lastToolUseTs = ts;
          if (block.name === 'Agent' || block.name === 'Task') {
            spawns.push({
              id: block.id ?? '',
              description: (block.input?.description ?? '').slice(0, 200),
              subagentType: block.input?.subagent_type ?? block.input?.agentType ?? 'agent',
              model: block.input?.model ?? null,
              promptPrefix: String(block.input?.prompt ?? '').slice(0, 150),
              ts,
            });
          } else if (!DELEGATION_TOOLS.has(block.name)) {
            // Non-delegation tools only: a dangling Agent/Task/Workflow call is delegation
            // (its result arrives when the work finishes), not a permission prompt.
            if (ts > main.lastNonDelegationToolUseTs) main.lastNonDelegationToolUseTs = ts;
          }
        }
      }
    }

    if (obj.type === 'user' && obj.message) {
      const role = userTurnRole(obj, dequeued);
      dequeued = false;
      if (role === 'prompt' && ts >= main.lastPromptTs) main.lastPromptTs = ts;
      if (textOf(obj.message.content).trimStart().startsWith('[Request interrupted')) {
        if (ts >= main.lastInterruptTs) main.lastInterruptTs = ts;
      }
      const content = obj.message.content;
      if (typeof content === 'string') {
        const m = content.match(/<task-id>([a-z0-9]+)<\/task-id>[\s\S]*?<status>completed<\/status>/);
        if (m) notifications.push({ agentId: m[1], ts });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === 'text' && typeof block.text === 'string') {
            const m = block.text.match(/<task-id>([a-z0-9]+)<\/task-id>[\s\S]*?<status>completed<\/status>/);
            if (m) notifications.push({ agentId: m[1], ts });
          }
          if (block?.type === 'tool_result') {
            const toolUseId: string = block.tool_use_id ?? '';
            let resultText = '';
            if (typeof block.content === 'string') {
              resultText = block.content;
            } else if (Array.isArray(block.content)) {
              for (const tb of block.content) {
                if (tb?.type === 'text' && typeof tb.text === 'string') resultText += tb.text;
              }
            }
            const agentIdMatch = resultText.match(/agentId:\s*([a-z0-9]+)/);
            results.set(toolUseId, {
              toolUseId,
              ts,
              agentId: agentIdMatch ? agentIdMatch[1] : null,
              isAsyncLaunch: /Async agent launched/i.test(resultText),
            });
            // Track the latest tool_result for the parent's waiting heuristic.
            // Only a user rejection counts toward "waiting" (red) — a benign tool failure keeps the agent going. Same classifier as the scanner.
            const isErr = isRejectedToolResult(block);
            if (ts >= main.lastToolResultTs) {
              main.lastToolResultTs = ts;
              main.lastResultIsError = isErr;
            }
          }
        }
      }
    }
    return true;
  };

  const finish = (): ParsedMain => {
    let effectiveTokens = keylessTokens;
    for (const eff of usageByKey.values()) effectiveTokens += eff;
    return {
      spawns: [...spawns],
      results: new Map(results),
      notifications: [...notifications],
      main: { ...main, effectiveTokens, firstTs: main.firstTs === Infinity ? 0 : main.firstTs },
    };
  };

  return { push, finish };
}

/** needsUser: an unresolved tool_use, a user rejection that's the last word, or a turn that ended in an API error/usage-limit; turnEnded: the last assistant line ended cleanly or was interrupted, with no prompt after. */
export function claudeMainSignals(main: MainInfo): { needsUser: boolean; turnEnded: boolean } {
  const pendingTool = main.lastNonDelegationToolUseTs > main.lastToolResultTs;
  const rejectedLast =
    main.lastResultIsError &&
    main.lastToolResultTs >= main.lastAssistantTs &&
    main.lastToolResultTs >= main.lastPromptTs;
  const turnError = main.lastAssistantIsError && main.lastAssistantTs >= main.lastPromptTs;
  const needsUser = pendingTool || rejectedLast || turnError;
  const interrupted =
    main.lastInterruptTs > 0 && main.lastInterruptTs >= main.lastPromptTs && main.lastInterruptTs >= main.lastAssistantTs;
  const endedTurn = main.lastAssistantEnded && main.lastAssistantTs >= main.lastPromptTs;
  return { needsUser, turnEnded: !needsUser && (endedTurn || interrupted) };
}

interface SidechainMeta {
  agentType: string;
  description: string;
  toolUseId: string;
  phase: string;
}

async function readSidechainMeta(file: string): Promise<SidechainMeta | null> {
  try {
    const raw = JSON.parse(await readFile(file.replace(/\.jsonl$/, '.meta.json'), 'utf8'));
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
      agentType: s(raw?.agentType),
      description: s(raw?.description).slice(0, 200),
      toolUseId: s(raw?.toolUseId),
      phase: s(raw?.workflowPhase),
    };
  } catch {
    return null;
  }
}

interface SidechainInfo {
  agentId: string;
  path: string;
  effectiveTokens: number;
  firstTs: number;
  lastTs: number;
  model: string;
  firstUserText: string;
  projectPath: string;
  mtime: number;
  meta: SidechainMeta | null;
  /** Workflow run id ('' for an ordinary Agent/Task subagent). */
  workflowRun: string;
  /** The main transcript this sidechain lives under ('' when unknown). */
  sessionFile: string;
}

interface SidechainParse {
  effectiveTokens: number;
  firstTs: number;
  lastTs: number;
  model: string;
  firstUserText: string;
  cwd: string;
}

function createSidechainParser(): LineParser<SidechainParse> {
  const s: SidechainParse = { effectiveTokens: 0, firstTs: Infinity, lastTs: 0, model: 'unknown', firstUserText: '', cwd: '' };
  return {
    push(line) {
      if (!line || line.length < 2) return false;
      let obj: any;
      try { obj = JSON.parse(line); } catch { return false; }

      const ts = Date.parse(obj.timestamp ?? '');
      if (Number.isNaN(ts)) return true;
      if (ts < s.firstTs) s.firstTs = ts;
      if (ts > s.lastTs) s.lastTs = ts;
      if (typeof obj.cwd === 'string' && obj.cwd) s.cwd = obj.cwd;

      if (!s.firstUserText && obj.type === 'user' && obj.message) {
        const c = obj.message.content;
        if (typeof c === 'string') s.firstUserText = c.slice(0, 150);
        else if (Array.isArray(c)) {
          for (const b of c) {
            if (b?.type === 'text' && typeof b.text === 'string') { s.firstUserText = b.text.slice(0, 150); break; }
          }
        }
      }

      if (obj.type === 'assistant' && obj.message?.usage) {
        const usage = obj.message.usage;
        s.effectiveTokens += num(usage.input_tokens) + num(usage.output_tokens) + num(usage.cache_creation_input_tokens);
        if (obj.message?.model && obj.message.model !== 'unknown' && obj.message.model !== '<synthetic>') s.model = obj.message.model;
      }
      return true;
    },
    finish: () => ({ ...s, firstTs: s.firstTs === Infinity ? 0 : s.firstTs }),
  };
}

async function parseSidechainFile(f: FileStat, agentId: string): Promise<SidechainInfo> {
  const p = await tailParse(sidechainCache, f, createSidechainParser);
  return {
    agentId,
    path: f.path,
    effectiveTokens: p.effectiveTokens,
    firstTs: p.firstTs,
    lastTs: p.lastTs,
    model: p.model,
    firstUserText: p.firstUserText,
    projectPath: p.cwd || projectPathFromFile(f.path),
    mtime: f.mtime,
    meta: await readSidechainMeta(f.path),
    workflowRun: workflowRunOf(f.path),
    sessionFile: sessionFileOfSidechain(f.path),
  };
}

/** agentIds a workflow run's journal.jsonl already logged as finished (`result` or `failed`). */
async function readWorkflowDone(runDir: string): Promise<Set<string>> {
  const done = new Set<string>();
  try {
    const text = await readFile(join(runDir, 'journal.jsonl'), 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line);
        if ((o?.type === 'result' || o?.type === 'failed') && typeof o.agentId === 'string') done.add(o.agentId);
      } catch { /* junk line */ }
    }
  } catch { /* no journal yet */ }
  return done;
}

/** Display name of a workflow agent: its label ("find:codex", "impl:agents") from the .meta.json sidecar. */
function workflowAgentName(sc: SidechainInfo): string {
  return sc.meta?.description || 'workflow agent';
}

function workflowAgentDescription(sc: SidechainInfo): string {
  return sc.meta?.phase ? `Workflow · ${sc.meta.phase} phase` : 'Workflow agent';
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/** Per-file parser state kept between ticks, so only appended bytes are read. */
const mainCache = new Map<string, TailEntry<ParsedMain>>();
const sidechainCache = new Map<string, TailEntry<SidechainParse>>();
let computeQueue: Promise<unknown> = Promise.resolve();

/** Exported with an injectable clock for the unit tests. Runs one at a time, since the caches are fed incrementally. */
export function computeLiveSubagents(now: number = Date.now()): Promise<LiveSubagentsData> {
  const run = computeQueue.then(() => computeLive(now));
  computeQueue = run.catch(() => undefined);
  return run;
}

async function computeLive(now: number): Promise<LiveSubagentsData> {
  const THIRTY_MIN = 30 * 60_000;
  const COMPLETED_WINDOW = 30 * 60_000; // recently-finished subagents linger ~30 min (mirrors the CLI Background-tasks "Finished" list)
  const BG_COMPLETED_WINDOW = 60 * 60_000; // outer cap for spawn age + sidechain enrichment

  const allFiles = await listJsonl(projectsDir());
  const fileByPath = new Map(allFiles.map((f) => [f.path, f]));

  // Long-running sessions easily pass 5MB; parsing stays cheap, so cap generously.
  const MAX_FILE = 50 * 1024 * 1024;

  // Sidechain transcripts modified in the last hour — model/token enrichment + activity signal.
  const scFiles: Array<{ f: FileStat; agentId: string }> = [];
  for (const f of allFiles) {
    // Widen to the background window so finished background tasks keep their
    // token/model enrichment for up to an hour.
    if (now - f.mtime >= BG_COMPLETED_WINDOW || f.size > MAX_FILE || !isSidechainPath(f.path)) continue;
    const agentId = agentIdFromFileName(f.path);
    if (!agentId) continue;
    scFiles.push({ f, agentId });
  }
  const scParsed: Array<SidechainInfo | undefined> = [];
  await runPool([...scFiles.keys()], READ_CONCURRENCY, async (i) => {
    try {
      scParsed[i] = await parseSidechainFile(scFiles[i].f, scFiles[i].agentId);
    } catch { /* vanished / unreadable this tick */ }
  });
  // Filled in walk order: the prompt-prefix fallback below takes the first match.
  const sidechains = new Map<string, SidechainInfo>();
  for (const sc of scParsed) if (sc) sidechains.set(sc.agentId, sc);
  evictExcept(sidechainCache, new Set(scFiles.map((x) => x.f.path)));
  const byToolUseId = new Map<string, SidechainInfo>();
  for (const sc of sidechains.values()) if (sc.meta?.toolUseId) byToolUseId.set(sc.meta.toolUseId, sc);

  // Workflow runs with a sidechain in the window: which of their agents already finished.
  const workflowDone = new Map<string, Set<string>>();
  for (const sc of sidechains.values()) {
    if (!sc.workflowRun) continue;
    const runDir = dirname(sc.path);
    if (!workflowDone.has(runDir)) workflowDone.set(runDir, await readWorkflowDone(runDir));
  }
  const workflowFinished = (sc: SidechainInfo) => workflowDone.get(dirname(sc.path))?.has(sc.agentId) ?? false;

  // Parents: conversations modified in the last 30 min, plus the session of any running sidechain — a Workflow run can outlast its session's last write.
  const parentPaths = new Set<string>();
  for (const f of allFiles) {
    if (now - f.mtime < THIRTY_MIN && f.size <= MAX_FILE && !isSidechainPath(f.path)) parentPaths.add(f.path);
  }
  for (const sc of sidechains.values()) {
    if (now - sc.mtime >= ACTIVE_WINDOW || (sc.workflowRun && workflowFinished(sc))) continue;
    const pf = fileByPath.get(sc.sessionFile);
    if (pf && pf.size <= MAX_FILE) parentPaths.add(pf.path);
  }

  const running: LiveSubagent[] = [];
  const recentlyCompleted: RecentlyCompletedSubagent[] = [];
  const claimedAgentIds = new Set<string>();
  const runningChildren = new Map<string, number>(); // parent path → running subagents
  const bumpRunning = (parent: string) => runningChildren.set(parent, (runningChildren.get(parent) ?? 0) + 1);
  const parsedParents: Array<{ path: string; mtime: number; parsed: ParsedMain; project: string }> = [];

  const parentFiles = [...parentPaths].flatMap((p) => fileByPath.get(p) ?? []);
  const parsedByPath = new Map<string, ParsedMain>();
  await runPool(parentFiles, READ_CONCURRENCY, async (pf) => {
    try {
      parsedByPath.set(pf.path, await tailParse(mainCache, pf, createMainParser));
    } catch { /* vanished / unreadable this tick */ }
  });
  evictExcept(mainCache, parentPaths);

  for (const pf of parentFiles) {
    const parsed = parsedByPath.get(pf.path);
    if (!parsed) continue;
    const project = parsed.main.cwd || projectPathFromFile(pf.path);
    parsedParents.push({ path: pf.path, mtime: pf.mtime, parsed, project });
    const notifiedAt = new Map(parsed.notifications.map((n) => [n.agentId, n.ts]));

    for (const spawn of parsed.spawns) {
      const spawnAge = now - spawn.ts;
      // Hard cap: an hour (covers the background "finished" window). The running
      // path below additionally requires the spawn to be < 30 min old.
      if (spawnAge >= BG_COMPLETED_WINDOW) continue;
      const result = parsed.results.get(spawn.id);

      // Link spawn → sidechain: by the sidecar's toolUseId, by agentId from an async-launch result, else by prompt prefix.
      let sc: SidechainInfo | undefined = spawn.id ? byToolUseId.get(spawn.id) : undefined;
      if (sc && claimedAgentIds.has(sc.agentId)) sc = undefined;
      if (!sc && result?.agentId) sc = sidechains.get(result.agentId);
      if (!sc && spawn.promptPrefix) {
        for (const cand of sidechains.values()) {
          if (claimedAgentIds.has(cand.agentId) || cand.workflowRun) continue;
          if (cand.firstUserText && spawn.promptPrefix.startsWith(cand.firstUserText.slice(0, 80))) {
            sc = cand;
            break;
          }
        }
      }
      if (sc) claimedAgentIds.add(sc.agentId);

      const model = sc && sc.model !== 'unknown' ? sc.model : (spawn.model ?? 'inherit');
      const doneAt =
        result && !result.isAsyncLaunch
          ? result.ts // foreground completion = the real tool_result
          : sc
            ? notifiedAt.get(sc.agentId) // background completion = task-notification
            : result?.agentId
              ? notifiedAt.get(result.agentId)
              : undefined;

      // Keep every recently-finished subagent for ~30 min so the dashboard mirrors
      // Claude Code's Background-tasks "Finished" list (these parallel Agent runs
      // return a normal tool_result, so they aren't flagged async — don't gate on it).
      const isBackground = result?.isAsyncLaunch === true;
      if (doneAt !== undefined) {
        if (now - doneAt < COMPLETED_WINDOW) {
          recentlyCompleted.push({
            key: spawn.id || `${pf.path}:${spawn.ts}`,
            parentKey: pf.path,
            name: spawn.subagentType,
            description: spawn.description,
            model,
            completedAt: doneAt,
            background: isBackground,
            effectiveTokens: sc?.effectiveTokens ?? 0,
            project: sc?.projectPath || project,
          });
        }
        continue;
      }

      // Running path: don't surface stale spawns as "running" beyond 30 min.
      if (spawnAge >= THIRTY_MIN) continue;

      // Still running. Background agents without a fresh sidechain are likely finished in a
      // way we missed (or hung) — only show them while their transcript is recently active.
      if (isBackground && (!sc || now - sc.mtime >= ACTIVE_WINDOW)) continue;

      running.push({
        key: spawn.id,
        parentKey: pf.path,
        name: spawn.subagentType,
        description: spawn.description,
        model,
        startedAt: spawn.ts,
        lastActivity: sc ? Math.max(sc.lastTs, sc.mtime) : spawn.ts,
        effectiveTokens: sc?.effectiveTokens ?? 0,
        project: sc?.projectPath || project,
        status: 'running',
        traffic: 'running',
      });
      bumpRunning(pf.path);
    }
  }

  // Sidechains no spawn claimed: Workflow agents (never spawned by Agent/Task) and children whose spawn rotated/compacted away — attach to their session by path, else fall back to "Other subagents".
  for (const sc of sidechains.values()) {
    if (claimedAgentIds.has(sc.agentId)) continue;
    const parentKey = fileByPath.has(sc.sessionFile) ? sc.sessionFile : '';
    if (sc.workflowRun) {
      if (workflowFinished(sc)) {
        const completedAt = Math.max(sc.lastTs, sc.firstTs) || sc.mtime;
        if (now - completedAt < COMPLETED_WINDOW) {
          recentlyCompleted.push({
            key: sc.agentId,
            parentKey,
            name: workflowAgentName(sc),
            description: workflowAgentDescription(sc),
            model: sc.model,
            completedAt,
            background: false,
            effectiveTokens: sc.effectiveTokens,
            project: sc.projectPath,
          });
        }
        continue;
      }
      if (now - sc.mtime >= ACTIVE_WINDOW) continue; // no result and silent: killed or hung
      running.push({
        key: sc.agentId,
        parentKey,
        name: workflowAgentName(sc),
        description: workflowAgentDescription(sc),
        model: sc.model,
        startedAt: sc.firstTs || sc.mtime,
        lastActivity: Math.max(sc.lastTs, sc.mtime),
        effectiveTokens: sc.effectiveTokens,
        project: sc.projectPath,
        status: 'running',
        traffic: 'running',
      });
      if (parentKey) bumpRunning(parentKey);
      continue;
    }
    if (now - sc.mtime >= ACTIVE_WINDOW) continue;
    running.push({
      key: sc.agentId,
      parentKey,
      name: sc.meta?.agentType || 'subagent',
      description: sc.meta?.description || sc.firstUserText.slice(0, 80),
      model: sc.model,
      startedAt: sc.firstTs || sc.mtime,
      lastActivity: Math.max(sc.lastTs, sc.mtime),
      effectiveTokens: sc.effectiveTokens,
      project: sc.projectPath,
      status: 'running',
      traffic: 'running',
    });
    if (parentKey) bumpRunning(parentKey);
  }

  const mainAgents: MainAgent[] = [];
  for (const { path, mtime, parsed, project } of parsedParents) {
    if (!parsed.main.hasAssistant) continue;
    const sinceWrite = now - mtime;
    const signals = claudeMainSignals(parsed.main);
    const state = mainAgentState({
      sinceWrite,
      selfActive: sinceWrite < MAIN_ACTIVE,
      runningChildren: runningChildren.get(path) ?? 0,
      ...signals,
    });
    if (!state.listed) continue;
    mainAgents.push({
      key: path,
      title: parsed.main.customTitle || parsed.main.title || projectNameFromPath(project),
      project,
      gitBranch: parsed.main.gitBranch,
      model: parsed.main.model,
      startedAt: parsed.main.firstTs || mtime,
      lastActivity: Math.max(parsed.main.lastTs, mtime),
      effectiveTokens: parsed.main.effectiveTokens,
      active: state.active,
      delegating: state.delegating,
      yourTurn: state.yourTurn,
      status: 'running',
      traffic: state.traffic,
    });
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

const LIVE_TTL_MS = 3_000;

let cachedLive: LiveSubagentsData | null = null;
let cachedLiveAt = 0;
let inflight: Promise<LiveSubagentsData> | null = null;

export async function getLiveSubagents(): Promise<LiveSubagentsData> {
  if (cachedLive && Date.now() - cachedLiveAt < LIVE_TTL_MS) return cachedLive;
  if (inflight) return inflight;
  inflight = computeLiveSubagents()
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
