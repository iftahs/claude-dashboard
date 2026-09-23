/**
 * sessions.ts — pure builders behind the Sessions tab routes in index.ts:
 * `/api/sessions` (the history table), `/api/sessions/summary` (its StatCard
 * row), `/api/search` (transcript search) and the legacy-path map `/api/projects`
 * returns for the tag-key migration. No I/O: callers pass the scan output, the
 * legacy sidecars and the Codex title index in.
 *
 * Both platforms get the same fields with the same meaning:
 *  - `turn_count` — user turns that got an answer (Claude: prompt → last reply,
 *    Codex: task_complete), the TurnRows merge.ts dedups. `user_message_count` is
 *    kept for the CSV export but counts every Claude user line, tool results included.
 *  - `assistant_message_count` — distinct model responses (Claude message ids,
 *    Codex response ids), subagents included on both.
 *  - `active_ms` — the sum of those turns' durations; `duration_minutes` stays the
 *    wall-clock span first → last record, idle days included.
 *  - `lines_added` / `lines_removed` / `pr_urls` — merge.ts history rows.
 *  - `title` — Claude's custom / AI title, Codex's session_index.jsonl name.
 */
import { sourceMatches, type SourceFilter } from './aggregate.ts';
import { codexTitleOf } from './codex-titles.ts';
import { legacyProjectPathFromFile, normalizeProjectPath, projectNameOf } from './project-path.ts';
import type { UsageEvent, UsageSource } from './scan.ts';
import type { TurnRow } from './scan-pass.ts';
import type { InsightsData, SessionMetaRecord } from './insights-scan.ts';

/** Tools that modify a file (Claude names; the Codex parser maps FileChange onto them). */
export const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Delete']);

export interface SessionRow {
  session_id: string;
  source: UsageSource;
  project_path: string;
  title?: string;
  start_time: string;
  /** Wall clock, first → last record. */
  duration_minutes: number;
  /** Sum of recorded turn durations; null when no turn was recorded (legacy sidecar rows). */
  active_ms: number | null;
  user_message_count: number;
  assistant_message_count: number;
  turn_count: number;
  tool_counts: Record<string, number>;
  languages: Record<string, number>;
  git_commits: number;
  git_pushes: number;
  input_tokens: number;
  output_tokens: number;
  cache_create_tokens: number;
  cache_read_tokens: number;
  effective_tokens: number;
  total_tokens: number;
  first_prompt: string;
  user_interruption_count?: number;
  tool_errors?: number;
  files_modified: number;
  lines_added: number;
  lines_removed: number;
  pr_urls: string[];
  client?: string;
  client_version?: string;
}

/** A session the history lists: a main session (not a subagent-only shell) that got an answer. */
export function isListedSession(sm: SessionMetaRecord): boolean {
  return !sm.isSidechain && !!sm.sessionId && sm.assistantMsgs > 0;
}

/** Claude's own title, else the Codex index's thread name. */
export function sessionTitle(sm: SessionMetaRecord, codexTitles: Map<string, string>): string | undefined {
  if (sm.title) return sm.title;
  if (sm.source === 'codex') return codexTitleOf(codexTitles, sm.sessionId);
  return undefined;
}

interface TokenStats {
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
}

export function buildSessionRows(
  events: UsageEvent[],
  insights: InsightsData,
  sidecar: any[],
  source: SourceFilter,
  codexTitles: Map<string, string>,
): SessionRow[] {
  // Token splits per session from the main (globally deduped) event scan.
  const tokens = new Map<string, TokenStats>();
  for (const e of events) {
    if (!e.sessionId) continue;
    let t = tokens.get(e.sessionId);
    if (!t) { t = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 }; tokens.set(e.sessionId, t); }
    t.input += e.inputTokens;
    t.output += e.outputTokens;
    t.cacheCreate += e.cacheCreateTokens;
    t.cacheRead += e.cacheReadTokens;
  }

  // Tool counts from main-thread calls; modified files from every write, subagents
  // included — the same scope as the line counts they sit next to.
  const toolCounts = new Map<string, Record<string, number>>();
  const files = new Map<string, Set<string>>();
  const addFile = (sessionId: string, fp: string | null) => {
    if (!fp) return;
    let set = files.get(sessionId);
    if (!set) { set = new Set(); files.set(sessionId, set); }
    set.add(fp);
  };
  for (const tc of insights.toolCalls) {
    if (!tc.sessionId) continue;
    if (WRITE_TOOLS.has(tc.name)) {
      // A write that failed or was declined modified nothing.
      const result = tc.id ? insights.toolResults.get(tc.id) : undefined;
      if (!result || (!result.is_error && !result.rejected)) addFile(tc.sessionId, tc.filePath);
    }
    if (tc.isSidechain) continue;
    let counts = toolCounts.get(tc.sessionId);
    if (!counts) { counts = {}; toolCounts.set(tc.sessionId, counts); }
    counts[tc.name] = (counts[tc.name] ?? 0) + 1;
  }
  for (const lc of insights.lineChanges) addFile(lc.sessionId, lc.filePath);

  const turnCount = new Map<string, number>();
  for (const t of insights.turns) turnCount.set(t.sessionId, (turnCount.get(t.sessionId) ?? 0) + 1);

  const sidecarById = new Map<string, any>();
  for (const s of sidecar) if (typeof s?.session_id === 'string') sidecarById.set(s.session_id, s);

  const rows: SessionRow[] = [];
  for (const sm of insights.sessionsMeta.values()) {
    if (!isListedSession(sm)) continue;
    if (!sourceMatches(sm.source, source)) continue;
    const t = tokens.get(sm.sessionId);
    const side = sidecarById.get(sm.sessionId);
    const turns = turnCount.get(sm.sessionId) ?? 0;
    const effective = t ? t.input + t.output + t.cacheCreate : sm.effectiveTokens;
    const total = t ? effective + t.cacheRead : sm.effectiveTokens;
    const title = sessionTitle(sm, codexTitles);
    rows.push({
      session_id: sm.sessionId,
      source: sm.source,
      project_path: sm.projectPath,
      ...(title ? { title } : {}),
      start_time: new Date(sm.firstTs).toISOString(),
      duration_minutes: Math.max(0, Math.round((sm.lastTs - sm.firstTs) / 60000)),
      active_ms: turns > 0 ? sm.activeMs : null,
      user_message_count: sm.turns,
      assistant_message_count: sm.assistantMsgs,
      turn_count: turns,
      tool_counts: toolCounts.get(sm.sessionId) ?? {},
      languages: side?.languages ?? {},
      git_commits: sm.gitCommits,
      git_pushes: sm.gitPushes,
      input_tokens: t?.input ?? 0,
      output_tokens: t?.output ?? 0,
      cache_create_tokens: t?.cacheCreate ?? 0,
      cache_read_tokens: t?.cacheRead ?? 0,
      effective_tokens: effective,
      total_tokens: total,
      first_prompt: (typeof side?.first_prompt === 'string' && side.first_prompt) || sm.firstPrompt || '',
      user_interruption_count: side?.user_interruptions,
      tool_errors: sm.errorCount,
      files_modified: files.get(sm.sessionId)?.size ?? side?.files_modified ?? 0,
      lines_added: sm.linesAdded || side?.lines_added || 0,
      lines_removed: sm.linesRemoved || side?.lines_removed || 0,
      pr_urls: sm.prUrls,
      ...(sm.client ? { client: sm.client } : {}),
      ...(sm.clientVersion ? { client_version: sm.clientVersion } : {}),
    });
  }

  // Older sessions whose transcripts are gone but whose legacy sidecar survives
  // stay listed, so the history never regresses. Sidecars are Claude Code only.
  if (source === 'all' || source === 'code' || source === 'claude') {
    const listed = new Set(rows.map((r) => r.session_id));
    for (const s of sidecar) {
      if (typeof s?.session_id !== 'string' || listed.has(s.session_id)) continue;
      const t = tokens.get(s.session_id);
      const inTok = s.input_tokens ?? 0;
      const outTok = s.output_tokens ?? 0;
      rows.push({
        session_id: s.session_id,
        source: 'code',
        project_path: normalizeProjectPath(typeof s.project_path === 'string' ? s.project_path : ''),
        start_time: s.start_time,
        duration_minutes: s.duration_minutes ?? 0,
        active_ms: null,
        user_message_count: s.user_message_count ?? 0,
        assistant_message_count: s.assistant_message_count ?? 0,
        turn_count: 0,
        tool_counts: s.tool_counts ?? {},
        languages: s.languages ?? {},
        git_commits: s.git_commits ?? 0,
        git_pushes: s.git_pushes ?? 0,
        input_tokens: t?.input ?? inTok,
        output_tokens: t?.output ?? outTok,
        cache_create_tokens: t?.cacheCreate ?? 0,
        cache_read_tokens: t?.cacheRead ?? 0,
        effective_tokens: t ? t.input + t.output + t.cacheCreate : inTok + outTok,
        total_tokens: t ? t.input + t.output + t.cacheCreate + t.cacheRead : inTok + outTok,
        first_prompt: typeof s.first_prompt === 'string' ? s.first_prompt : '',
        user_interruption_count: s.user_interruptions,
        tool_errors: s.tool_errors,
        files_modified: s.files_modified ?? 0,
        lines_added: s.lines_added ?? 0,
        lines_removed: s.lines_removed ?? 0,
        pr_urls: [],
      });
    }
  }

  rows.sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time));
  return rows;
}

// ---------------------------------------------------------------------------
// Summary row
// ---------------------------------------------------------------------------

export interface SessionSummaryPart {
  sessions: number;
  /** Earliest session start (epoch ms), null when there are none. */
  since: number | null;
  longestActiveMs: number;
  longestSessionId: string | null;
  /** Title, else first prompt, else project name of the longest session. */
  longestLabel: string;
  medianTurnMs: number | null;
  turnCount: number;
  linesAdded: number;
  linesRemoved: number;
}

export interface SessionSummary {
  total: SessionSummaryPart;
  /** Claude Code + Cowork. */
  claude: SessionSummaryPart;
  codex: SessionSummaryPart;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function summarize(rows: SessionRow[], turnsBySession: Map<string, number[]>): SessionSummaryPart {
  let since: number | null = null;
  let longest: SessionRow | null = null;
  let linesAdded = 0;
  let linesRemoved = 0;
  const durations: number[] = [];
  for (const r of rows) {
    const start = Date.parse(r.start_time);
    if (!Number.isNaN(start) && (since === null || start < since)) since = start;
    if (r.active_ms !== null && (!longest || r.active_ms > (longest.active_ms ?? 0))) longest = r;
    linesAdded += r.lines_added;
    linesRemoved += r.lines_removed;
    const d = turnsBySession.get(r.session_id);
    if (d) durations.push(...d);
  }
  const label = longest
    ? longest.title || longest.first_prompt.slice(0, 80) || projectNameOf(longest.project_path) || ''
    : '';
  return {
    sessions: rows.length,
    since,
    longestActiveMs: longest?.active_ms ?? 0,
    longestSessionId: longest?.session_id ?? null,
    longestLabel: label,
    medianTurnMs: median(durations),
    turnCount: durations.length,
    linesAdded,
    linesRemoved,
  };
}

/** The Sessions StatCard row, over exactly the rows the table lists, split per platform. */
export function buildSessionSummary(rows: SessionRow[], turns: TurnRow[]): SessionSummary {
  const turnsBySession = new Map<string, number[]>();
  for (const t of turns) {
    let list = turnsBySession.get(t.sessionId);
    if (!list) { list = []; turnsBySession.set(t.sessionId, list); }
    list.push(t.durationMs);
  }
  return {
    total: summarize(rows, turnsBySession),
    claude: summarize(rows.filter((r) => r.source !== 'codex'), turnsBySession),
    codex: summarize(rows.filter((r) => r.source === 'codex'), turnsBySession),
  };
}

// ---------------------------------------------------------------------------
// Transcript search
// ---------------------------------------------------------------------------

export interface SearchHit {
  sessionId: string;
  source: UsageSource;
  /** Last path segment of the project — what the old strip showed. */
  project: string;
  projectPath: string;
  title?: string;
  date: string;
  snippet: string;
  matches: number;
}

function countMatches(haystackLower: string, needleLower: string): { count: number; first: number } {
  let count = 0;
  let first = -1;
  let idx = 0;
  while ((idx = haystackLower.indexOf(needleLower, idx)) !== -1) {
    count++;
    if (first === -1) first = idx;
    idx += needleLower.length;
  }
  return { count, first };
}

function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Sessions whose prompts (or title) mention `q`, most matches first. Scoped like
 * the table — same platform/surface, main sessions only — so every hit is a row
 * the strip can open.
 */
export function searchSessions(
  insights: InsightsData,
  q: string,
  from: number,
  source: SourceFilter,
  codexTitles: Map<string, string>,
  limit = 30,
): SearchHit[] {
  const qLower = q.toLowerCase();
  const hits: SearchHit[] = [];
  for (const sm of insights.sessionsMeta.values()) {
    if (!isListedSession(sm) || !sourceMatches(sm.source, source) || sm.lastTs < from) continue;
    const corpus = insights.searchCorpus.get(sm.sessionId) ?? '';
    const title = sessionTitle(sm, codexTitles);
    const inCorpus = countMatches(corpus.toLowerCase(), qLower);
    const inTitle = title ? countMatches(title.toLowerCase(), qLower).count : 0;
    const matches = inCorpus.count + inTitle;
    if (matches === 0) continue;

    let snippet = '';
    if (inCorpus.first !== -1) {
      const start = Math.max(0, inCorpus.first - 60);
      const end = Math.min(corpus.length, inCorpus.first + q.length + 60);
      snippet = (start > 0 ? '…' : '') + corpus.slice(start, end) + (end < corpus.length ? '…' : '');
    }
    hits.push({
      sessionId: sm.sessionId,
      source: sm.source,
      project: sm.projectPath ? projectNameOf(sm.projectPath) : 'unknown',
      projectPath: sm.projectPath,
      ...(title ? { title } : {}),
      date: localDate(sm.firstTs),
      snippet,
      matches,
    });
  }
  hits.sort((a, b) => b.matches - a.matches);
  return hits.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Tag-key migration
// ---------------------------------------------------------------------------

/**
 * Project path → the other paths the same project was filed under before the
 * cwd-based derivation (project-path.ts): the lossy folder decode of a Claude
 * session's directory, and a legacy sidecar path in its raw form. The UI keys
 * user tags by project path, so it moves tags stored under these onto the new one.
 */
export function legacyProjectPaths(insights: InsightsData, sidecar: any[]): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  const add = (path: string, legacy: string) => {
    if (!path || !legacy || legacy === path) return;
    let set = out.get(path);
    if (!set) { set = new Set(); out.set(path, set); }
    set.add(legacy);
  };
  for (const sm of insights.sessionsMeta.values()) {
    if (sm.source !== 'code' || !sm.file) continue;
    add(sm.projectPath, legacyProjectPathFromFile(sm.file));
  }
  for (const s of sidecar) {
    if (typeof s?.project_path !== 'string' || !s.project_path) continue;
    add(normalizeProjectPath(s.project_path), s.project_path);
  }
  return new Map([...out].map(([k, v]) => [k, [...v]]));
}
