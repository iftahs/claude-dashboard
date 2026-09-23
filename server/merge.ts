/**
 * merge.ts — pure reduction from per-file rows to the shapes the endpoints consume.
 *
 * No I/O. Given the same rows it always produces the same output, which is what
 * makes the on-disk row cache safe: rows are parsed once per file version and this
 * reduction re-runs on every load.
 *
 * Why the reduction cannot be folded back into the parser: 11,021 of 38,821 dedup
 * keys (28.4%) appear in more than one file, and 75 of 189 sessions span multiple
 * files. Any per-file pre-summing double-counts those. Everything that needs global
 * knowledge is therefore computed here, from rows that carry their own identity.
 *
 * Codex rows (scan-pass-codex.ts) flow through unchanged: their dedup keys are
 * `codex:<response_id>` (never ':'), a guardian review rollout arrives as a
 * sidechain partial whose sessionId is the parent thread — exactly like a Claude
 * `subagents/agent-*.jsonl` file — and its TaskSpawnRow is marked completed by a
 * result row the parser emits with agentIdFromResult = the guardian's own id.
 */
import { estimateCost } from './pricing.ts';
import { normalizeProjectPath } from './project-path.ts';
import type { UsageEvent, UsageSource } from './scan.ts';
import type {
  CorpusRow, FileRows, LimitHitRow, LineChangeRow, PrLinkRow, RateLimitSnapRow, SessionPartialRow,
  TaskSpawnRow, ToolCallRow, TurnRow, UsageRow,
} from './scan-pass.ts';
import type {
  InsightsData, SessionMetaRecord, TaskSpawnRecord, ToolCallRecord, ToolResultRecord,
} from './insights-scan.ts';

const CORPUS_CAP = 20 * 1024;

function effective(r: UsageRow): number {
  return r.inputTokens + r.outputTokens + r.cacheCreateTokens;
}

/** (source, sessionId, path the parser derived) → the session's project path. */
export type ProjectPathResolver = (source: UsageSource, sessionId: string, rawPath: string) => string;

/**
 * One project path per session, for every row that carries one (usage events,
 * tool calls, task spawns, sessionsMeta), so a session never lands in two projects.
 *
 *  - Claude Code: the real `cwd` the transcript recorded (a main-session file's
 *    cwd beats a subagent's), normalised like the Codex parser's paths; else the
 *    legacy session-meta sidecar's path; else the real path other sessions from the
 *    same `projects/<encoded>` folder recorded (a file over the insights size cap
 *    yields no session partial, so no cwd); else the lossy folder decode.
 *  - Codex: the parser's session_meta cwd, normalised (worktree fold).
 *  - Cowork: blank — sandbox-internal paths mean nothing on the host.
 *
 * Applied here, not at parse time, so cached rows stay valid when this rule or
 * usage-data/session-meta/*.json changes. See project-path.ts.
 */
export function buildProjectPathResolver(partials: SessionPartialRow[], sessionMetas: any[]): ProjectPathResolver {
  const sidecarPath = new Map<string, string>();
  for (const s of sessionMetas) {
    if (typeof s?.session_id === 'string' && typeof s?.project_path === 'string' && s.project_path) {
      sidecarPath.set(s.session_id, normalizeProjectPath(s.project_path));
    }
  }

  const cwdBySession = new Map<string, string>();
  const fromMain = new Set<string>();
  // legacy decoded folder → real path → sessions that recorded it
  const votes = new Map<string, Map<string, Set<string>>>();
  for (const p of partials) {
    if (p.source !== 'code' || !p.cwd) continue;
    const real = normalizeProjectPath(p.cwd);
    if (!real) continue;
    if (!cwdBySession.has(p.sessionId) || (!p.fileIsSidechain && !fromMain.has(p.sessionId))) {
      cwdBySession.set(p.sessionId, real);
    }
    if (!p.fileIsSidechain) fromMain.add(p.sessionId);
    if (p.projectPath) {
      let byReal = votes.get(p.projectPath);
      if (!byReal) { byReal = new Map(); votes.set(p.projectPath, byReal); }
      let ids = byReal.get(real);
      if (!ids) { ids = new Set(); byReal.set(real, ids); }
      ids.add(p.sessionId);
    }
  }
  const legacyToReal = new Map<string, string>();
  for (const [legacy, byReal] of votes) {
    let best = '';
    let bestN = 0;
    for (const [real, ids] of byReal) {
      if (ids.size > bestN) { best = real; bestN = ids.size; } // ties: first seen (file order)
    }
    if (best) legacyToReal.set(legacy, best);
  }

  return (source, sessionId, rawPath) => {
    if (source === 'cowork') return rawPath; // '' from the parser
    if (source === 'codex') return normalizeProjectPath(rawPath);
    return (
      (sessionId && (cwdBySession.get(sessionId) ?? sidecarPath.get(sessionId))) ||
      legacyToReal.get(rawPath) ||
      rawPath
    );
  };
}

function toEvent(r: UsageRow, projectPathOf: ProjectPathResolver): UsageEvent {
  const projectPath = projectPathOf(r.source, r.sessionId, r.projectPathRaw);
  return {
    ts: r.ts,
    sessionId: r.sessionId,
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    cacheCreateTokens: r.cacheCreateTokens,
    cacheReadTokens: r.cacheReadTokens,
    tools: r.tools,
    isSidechain: r.isSidechain,
    rootSessionId: r.rootSessionId,
    attributionAgent: r.attributionAgent,
    attributionSkill: r.attributionSkill,
    attributionMcpServer: r.attributionMcpServer,
    attributionPlugin: r.attributionPlugin,
    projectPath,
    gitBranch: r.gitBranch,
    source: r.source,
    effort: r.effort ?? '',
    reasoningTokens: r.reasoningTokens ?? null,
  };
}

/** First row per key wins (files arrive in listing order); result sorted by ts. */
function dedupBy<T extends { ts: number }>(rows: T[], key: (r: T) => string): T[] {
  return firstBy(rows, key).sort((a, b) => a.ts - b.ts);
}

/** First row per key, in input order; rows with an empty key are dropped, or all kept with `keepBlank`. */
function firstBy<T>(rows: T[], key: (r: T) => string, keepBlank = false): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = key(r);
    if (!k) {
      if (keepBlank) out.push(r);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * Global keep-max dedup over usage rows.
 * Rows without an identity (dedupKey ':') cannot be deduped and are all kept —
 * matching scan.ts:237-249.
 */
function dedupUsage(rows: UsageRow[]): UsageRow[] {
  const byKey = new Map<string, number>();
  const out: UsageRow[] = [];
  for (const r of rows) {
    if (r.dedupKey === ':') {
      out.push(r);
      continue;
    }
    const idx = byKey.get(r.dedupKey);
    if (idx === undefined) {
      byKey.set(r.dedupKey, out.length);
      out.push(r);
    } else if (effective(r) > effective(out[idx])) {
      out[idx] = r;
    }
  }
  return out;
}

const byTs = (a: { ts: number }, b: { ts: number }) => a.ts - b.ts;

function sessionCost(r: UsageRow): number {
  return estimateCost(r.model, {
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    cacheCreateTokens: r.cacheCreateTokens,
    cacheReadTokens: 0,
  });
}

/** Without `projectPathOf` the parser's raw path is kept (the archive resolves it per merge). */
function toolCallRecords(rows: ToolCallRow[], projectPathOf?: ProjectPathResolver): ToolCallRecord[] {
  return firstBy(rows, (t) => t.toolId, true).map((t) => ({
    ts: t.ts, sessionId: t.sessionId, name: t.name, isSidechain: t.isSidechain,
    mcpServer: t.mcpServer, filePath: t.filePath, gitBranch: t.gitBranch,
    projectPath: projectPathOf ? projectPathOf(t.source, t.sessionId, t.projectPath) : t.projectPath,
    id: t.toolId, source: t.source,
  }));
}

/** dedupUsage of live-then-archive, per live key: the winner takes the live slot, the archive copy is dropped. */
function settleUsage(live: UsageRow[], archived: UsageRow[], indexOf: (key: string) => number): Uint8Array {
  const dropped = new Uint8Array(archived.length);
  for (let i = 0; i < live.length; i++) {
    const r = live[i];
    if (r.dedupKey === ':') continue;
    const j = indexOf(r.dedupKey);
    if (j < 0) continue;
    dropped[j] = 1;
    if (effective(archived[j]) > effective(r)) live[i] = archived[j];
  }
  return dropped;
}

/** Two ts-sorted lists as one stable sort of live-then-archive would order them. */
function mergeByTs<T extends { ts: number }>(live: T[], archived: T[], dropped: (i: number) => boolean): T[] {
  const out: T[] = [];
  let a = 0;
  for (const x of live) {
    for (; a < archived.length && archived[a].ts < x.ts; a++) if (!dropped(a)) out.push(archived[a]);
    out.push(x);
  }
  for (; a < archived.length; a++) if (!dropped(a)) out.push(archived[a]);
  return out;
}

export interface MergeResult {
  events: UsageEvent[];
  insights: InsightsData;
}

/** Cowork Dispatch's orchestrator relays each prompt to a worker under the same uuid; the worker holds the real turn. */
const DISPATCH_ORCHESTRATOR = /[\\/]agent[\\/]local_ditto_/;

/** Rows gathered from files in merge order, before any cross-file reduction. */
interface MergeParts {
  allUsage: UsageRow[];
  /** Usage of insight-eligible files only, for per-session tokens and cost. */
  insightUsage: UsageRow[];
  toolCallRows: ToolCallRow[];
  taskSpawnRows: TaskSpawnRow[];
  sessionPartials: SessionPartialRow[];
  corpusRows: CorpusRow[];
  limitHitRows: LimitHitRow[];
  rateLimitRows: RateLimitSnapRow[];
  lineChangeRows: LineChangeRow[];
  prLinkRows: PrLinkRow[];
  turnRows: TurnRow[];
  /** Dispatch orchestrator copies, ranked after every other file's so a worker keeps its turns. */
  relayedTurnRows: TurnRow[];
  customTitle: Map<string, string>;
  aiTitle: Map<string, string>;
  toolResults: Map<string, ToolResultRecord>;
  resultBySession: Map<string, string | null>; // `${toolId}|${sessionId}` -> agentId
  nonErrorResultIds: Set<string>;
}

function collect(files: FileRows[]): MergeParts {
  const p: MergeParts = {
    allUsage: [], insightUsage: [], toolCallRows: [], taskSpawnRows: [], sessionPartials: [], corpusRows: [],
    limitHitRows: [], rateLimitRows: [], lineChangeRows: [], prLinkRows: [], turnRows: [], relayedTurnRows: [],
    // Titles carry no timestamp: a later record (file order, then line order) wins,
    // and a user's custom rename beats Claude's generated ai-title.
    customTitle: new Map(), aiTitle: new Map(),
    toolResults: new Map(), resultBySession: new Map(), nonErrorResultIds: new Set(),
  };

  for (const f of files) {
    for (const u of f.usage) {
      p.allUsage.push(u);
      if (!f.insightsSkipped) p.insightUsage.push(u);
    }
    // Limit hits and rate-limit snapshots are cheap and matter for every file.
    if (f.limitHits) p.limitHitRows.push(...f.limitHits);
    if (f.rateLimitSnaps) p.rateLimitRows.push(...f.rateLimitSnaps);
    if (f.insightsSkipped) continue;
    if (f.lineChanges) p.lineChangeRows.push(...f.lineChanges);
    if (f.prLinks) p.prLinkRows.push(...f.prLinks);
    if (f.turns) {
      const relayed = f.source === 'cowork' && DISPATCH_ORCHESTRATOR.test(f.path);
      (relayed ? p.relayedTurnRows : p.turnRows).push(...f.turns);
    }
    for (const t of [...(f.titles ?? [])].sort((a, b) => a.seq - b.seq)) {
      (t.kind === 'custom' ? p.customTitle : p.aiTitle).set(t.sessionId, t.title);
    }
    p.toolCallRows.push(...f.toolCalls);
    p.taskSpawnRows.push(...f.taskSpawns);
    p.sessionPartials.push(...f.sessions);
    p.corpusRows.push(...f.corpus);
    for (const r of f.toolResults) {
      // Last write wins, matching the original `toolResults.set(...)` per line.
      p.toolResults.set(r.toolId, {
        id: r.toolId, is_error: r.isError, rejected: r.rejected, errorText: r.errorText,
      });
      if (r.agentIdFromResult) p.resultBySession.set(`${r.toolId}|${r.sessionId}`, r.agentIdFromResult);
      // A rejected call never ran: a declined Codex `git commit` is not a commit.
      if (!r.isError && !r.rejected) p.nonErrorResultIds.add(r.toolId);
    }
  }
  return p;
}

/**
 * The archive merged once: archived files always follow the live ones and every
 * reduction is first-wins or keep-max, so a merge only settles live rows against it.
 */
export interface ReducedArchive {
  parts: MergeParts;
  usage: UsageRow[];
  usageIndex: Map<string, number>;
  usageByTs: number[];
  /** Distinct (source, sessionId, raw path) of `usage` and `toolCalls`: all the resolver is ever asked about them. */
  pathKeys: [UsageSource, string, string][];
  resolved: { sig: string; events: UsageEvent[]; toolCalls: ToolCallRecord[] } | null;
  insight: UsageRow[];
  insightOfUsage: Int32Array; // `usage` index -> `insight` index of the same key, -1 when none
  insightBySession: Map<string, number[]>;
  insightCost: Float64Array;
  toolCalls: ToolCallRecord[];
  toolCallIndex: Map<string, number>;
  toolCallsBySession: Map<string, number>;
  keysBySession: Map<string, Set<string>>;
}

export function reduceArchive(files: FileRows[]): ReducedArchive {
  const p = collect(files);

  const usage = dedupUsage(p.allUsage);
  const usageIndex = new Map<string, number>();
  usage.forEach((r, i) => {
    if (r.dedupKey !== ':') usageIndex.set(r.dedupKey, i);
  });
  const tsOf = Float64Array.from(usage, (r) => r.ts);
  const usageByTs = usage.map((_, i) => i).sort((a, b) => tsOf[a] - tsOf[b] || a - b);

  const insight = dedupUsage(p.insightUsage);
  const insightOfUsage = new Int32Array(usage.length).fill(-1);
  const insightBySession = new Map<string, number[]>();
  const insightCost = new Float64Array(insight.length);
  insight.forEach((r, j) => {
    if (r.dedupKey === ':') return;
    insightOfUsage[usageIndex.get(r.dedupKey)!] = j;
    insightCost[j] = sessionCost(r);
    const list = insightBySession.get(r.sessionId);
    if (list) list.push(j);
    else insightBySession.set(r.sessionId, [j]);
  });

  const toolCalls = toolCallRecords(p.toolCallRows).sort(byTs);
  const toolCallIndex = new Map<string, number>();
  const toolCallsBySession = new Map<string, number>();
  toolCalls.forEach((t, i) => {
    if (t.id) toolCallIndex.set(t.id, i);
    toolCallsBySession.set(t.sessionId, (toolCallsBySession.get(t.sessionId) ?? 0) + 1);
  });

  const pathKeys = new Map<string, [UsageSource, string, string]>();
  const addPathKey = (key: [UsageSource, string, string]) => {
    const k = JSON.stringify(key);
    if (!pathKeys.has(k)) pathKeys.set(k, key);
  };
  for (const r of usage) addPathKey([r.source, r.sessionId, r.projectPathRaw]);
  for (const t of toolCalls) addPathKey([t.source, t.sessionId, t.projectPath]);

  const keysBySession = new Map<string, Set<string>>();
  for (const s of p.sessionPartials) {
    let set = keysBySession.get(s.sessionId);
    if (!set) keysBySession.set(s.sessionId, (set = new Set()));
    for (const k of s.assistantKeys) set.add(k);
  }

  p.allUsage = [];
  p.insightUsage = [];
  p.toolCallRows = [];
  p.sessionPartials = p.sessionPartials.map((s) => ({ ...s, assistantKeys: [] }));
  p.taskSpawnRows = firstBy(p.taskSpawnRows, (t) => t.toolId, true);
  p.limitHitRows = firstBy(p.limitHitRows, (r) => r.key);
  p.rateLimitRows = firstBy(p.rateLimitRows, (r) => r.key);
  p.lineChangeRows = firstBy(p.lineChangeRows, (r) => r.key);
  p.prLinkRows = firstBy(p.prLinkRows, (r) => r.url);
  p.turnRows = firstBy(p.turnRows, (r) => r.key);
  p.relayedTurnRows = firstBy(p.relayedTurnRows, (r) => r.key);

  return {
    parts: p, usage, usageIndex, usageByTs, pathKeys: [...pathKeys.values()], resolved: null,
    insight, insightOfUsage, insightBySession,
    insightCost, toolCalls, toolCallIndex, toolCallsBySession, keysBySession,
  };
}

const NO_ARCHIVE = reduceArchive([]);

function append(p: MergeParts, tail: MergeParts): void {
  p.taskSpawnRows = p.taskSpawnRows.concat(tail.taskSpawnRows);
  p.sessionPartials = p.sessionPartials.concat(tail.sessionPartials);
  p.corpusRows = p.corpusRows.concat(tail.corpusRows);
  p.limitHitRows = p.limitHitRows.concat(tail.limitHitRows);
  p.rateLimitRows = p.rateLimitRows.concat(tail.rateLimitRows);
  p.lineChangeRows = p.lineChangeRows.concat(tail.lineChangeRows);
  p.prLinkRows = p.prLinkRows.concat(tail.prLinkRows);
  p.turnRows = p.turnRows.concat(tail.turnRows);
  p.relayedTurnRows = p.relayedTurnRows.concat(tail.relayedTurnRows);
  for (const [k, v] of tail.customTitle) p.customTitle.set(k, v);
  for (const [k, v] of tail.aiTitle) p.aiTitle.set(k, v);
  for (const [k, v] of tail.toolResults) p.toolResults.set(k, v);
  for (const [k, v] of tail.resultBySession) p.resultBySession.set(k, v);
  for (const id of tail.nonErrorResultIds) p.nonErrorResultIds.add(id);
}

/** The archive's events (ts order) and tool calls (index-aligned with `a.toolCalls`) with resolved project paths. */
function resolveArchive(a: ReducedArchive, projectPathOf: ProjectPathResolver): { events: UsageEvent[]; toolCalls: ToolCallRecord[] } {
  if (!a.pathKeys.length) return { events: [], toolCalls: [] };
  // Keyed on the resolver's answers, not its inputs: live partials and sidecars both move archived sessions.
  const sig = JSON.stringify(a.pathKeys.map(([source, sessionId, raw]) => projectPathOf(source, sessionId, raw)));
  if (a.resolved?.sig !== sig) {
    a.resolved = {
      sig,
      events: a.usageByTs.map((i) => toEvent(a.usage[i], projectPathOf)),
      toolCalls: a.toolCalls.map((t) => ({ ...t, projectPath: projectPathOf(t.source, t.sessionId, t.projectPath) })),
    };
  }
  return a.resolved;
}

/** `archive` merges as if its files were listed after `files`; it is never modified, beyond its resolved-path cache. */
export function mergeRows(files: FileRows[], sessionMetas: any[], archive: ReducedArchive = NO_ARCHIVE): MergeResult {
  const parts = collect(files);
  append(parts, archive.parts);
  const {
    taskSpawnRows, sessionPartials, corpusRows, limitHitRows, rateLimitRows, lineChangeRows, prLinkRows,
    customTitle, aiTitle, toolResults, resultBySession, nonErrorResultIds,
  } = parts;

  const projectPathOf = buildProjectPathResolver(sessionPartials, sessionMetas);
  const archived = resolveArchive(archive, projectPathOf);

  const liveUsage = dedupUsage(parts.allUsage);
  const usageDropped = settleUsage(liveUsage, archive.usage, (k) => archive.usageIndex.get(k) ?? -1);
  const events = mergeByTs(
    liveUsage.map((r) => toEvent(r, projectPathOf)).sort(byTs),
    archived.events,
    (a) => usageDropped[archive.usageByTs[a]] === 1,
  );

  // ---- tool calls: distinct by tool_use id ----
  const liveCalls = toolCallRecords(parts.toolCallRows, projectPathOf);
  const callsDropped = new Uint8Array(archive.toolCalls.length);
  const callsBySession = new Map(archive.toolCallsBySession);
  const count = (sessionId: string, n: number) => callsBySession.set(sessionId, (callsBySession.get(sessionId) ?? 0) + n);
  for (const t of liveCalls) {
    count(t.sessionId, 1);
    const j = t.id ? archive.toolCallIndex.get(t.id) : undefined;
    if (j === undefined) continue;
    callsDropped[j] = 1;
    count(archive.toolCalls[j].sessionId, -1);
  }
  const toolCalls = mergeByTs(liveCalls.sort(byTs), archived.toolCalls, (a) => callsDropped[a] === 1);

  // ---- task spawns: distinct by tool_use id, completion resolved from results ----
  const seenTask = new Set<string>();
  const taskSpawns: TaskSpawnRecord[] = [];
  for (const t of taskSpawnRows) {
    if (t.toolId) {
      if (seenTask.has(t.toolId)) continue;
      seenTask.add(t.toolId);
    }
    // Original matched on (tool_use_id, sessionId) — a Map lookup here replaces the
    // linear taskSpawns.find() that made the old scan O(results x spawns).
    const agentId = resultBySession.get(`${t.toolId}|${t.sessionId}`) ?? null;
    taskSpawns.push({
      ts: t.ts, sessionId: t.sessionId, id: t.toolId, subagentType: t.subagentType,
      model: t.model, description: t.description, agentIdFromResult: agentId,
      completed: agentId !== null, gitBranch: t.gitBranch,
      projectPath: projectPathOf(t.source, t.sessionId, t.projectPath),
      source: t.source,
    });
  }
  taskSpawns.sort((a, b) => a.ts - b.ts);

  // ---- session metadata ----
  const sessionsMeta = new Map<string, SessionMetaRecord>();
  const assistantKeysBySession = new Map<string, Set<string>>();
  const gitCommitIdsBySession = new Map<string, string[]>();
  const gitPushIdsBySession = new Map<string, string[]>();

  for (const p of sessionPartials) {
    let sm = sessionsMeta.get(p.sessionId);
    if (!sm) {
      sm = {
        sessionId: p.sessionId,
        isSidechain: p.fileIsSidechain,
        firstTs: p.firstTs,
        lastTs: p.lastTs,
        turns: 0, assistantMsgs: 0, toolCallCount: 0, errorCount: 0, rejectionCount: 0,
        subagentSpawns: 0, compactions: 0, committed: false, gitCommits: 0, gitPushes: 0,
        firstPrompt: '', gitBranch: p.gitBranch, projectPath: projectPathOf(p.source, p.sessionId, p.projectPath),
        models: {}, effectiveTokens: 0, cost: 0, file: p.file,
        agentId: p.agentId ?? undefined, source: p.source,
        linesAdded: 0, linesRemoved: 0, activeMs: 0, prUrls: [],
      };
      sessionsMeta.set(p.sessionId, sm);
    } else if (!p.fileIsSidechain && sm.isSidechain) {
      // A parent-session file is authoritative and clears a flag set by a subagent file.
      // It is also the transcript to show and the path to file the session under: a
      // guardian / subagent rollout that sorted first must not stand in for its parent.
      sm.isSidechain = false;
      sm.file = p.file;
      sm.projectPath = projectPathOf(p.source, p.sessionId, p.projectPath);
    }
    if (p.firstTs < sm.firstTs) sm.firstTs = p.firstTs;
    if (p.lastTs > sm.lastTs) sm.lastTs = p.lastTs;
    if (p.gitBranch && !sm.gitBranch) sm.gitBranch = p.gitBranch;
    if (p.firstPrompt && !sm.firstPrompt) sm.firstPrompt = p.firstPrompt;
    if (p.cwd && !sm.cwd) sm.cwd = p.cwd;
    if (p.client && !sm.client) sm.client = p.client;
    if (p.clientVersion && !sm.clientVersion) sm.clientVersion = p.clientVersion;
    if (p.repoUrl && !sm.repoUrl) sm.repoUrl = p.repoUrl;
    sm.turns += p.turns;
    sm.compactions += p.compactions;
    sm.errorCount += p.errorCount;
    sm.rejectionCount += p.rejectionCount;

    let ak = assistantKeysBySession.get(p.sessionId);
    if (!ak) { ak = new Set(); assistantKeysBySession.set(p.sessionId, ak); }
    for (const k of p.assistantKeys) ak.add(k);

    if (p.gitCommitIds.length) {
      const arr = gitCommitIdsBySession.get(p.sessionId) ?? [];
      arr.push(...p.gitCommitIds);
      gitCommitIdsBySession.set(p.sessionId, arr);
    }
    if (p.gitPushIds.length) {
      const arr = gitPushIdsBySession.get(p.sessionId) ?? [];
      arr.push(...p.gitPushIds);
      gitPushIdsBySession.set(p.sessionId, arr);
    }
  }

  // assistantMsgs = distinct message identities, not lines (the old code counted
  // every streaming retry, inflating this ~3.06x).
  for (const [sessionId, keys] of assistantKeysBySession) {
    const sm = sessionsMeta.get(sessionId);
    if (!sm) continue;
    const held = archive.keysBySession.get(sessionId);
    let n = held?.size ?? 0;
    for (const k of keys) if (!held?.has(k)) n++;
    sm.assistantMsgs = n;
  }

  // git commit/push resolution is global: the tool_use and its result can sit in
  // different files, which the old per-file pending maps could not express.
  for (const [sessionId, ids] of gitCommitIdsBySession) {
    const sm = sessionsMeta.get(sessionId);
    if (!sm) continue;
    const resolved = new Set(ids.filter((id) => nonErrorResultIds.has(id)));
    sm.gitCommits = resolved.size;
    sm.committed = resolved.size > 0;
  }
  for (const [sessionId, ids] of gitPushIdsBySession) {
    const sm = sessionsMeta.get(sessionId);
    if (!sm) continue;
    sm.gitPushes = new Set(ids.filter((id) => nonErrorResultIds.has(id))).size;
  }

  // toolCallCount / subagentSpawns from the deduped collections.
  for (const [sessionId, n] of callsBySession) {
    const sm = sessionsMeta.get(sessionId);
    if (sm) sm.toolCallCount += n;
  }
  for (const t of taskSpawns) {
    const sm = sessionsMeta.get(t.sessionId);
    if (sm) sm.subagentSpawns++;
  }

  // Per-session tokens and cost from globally deduped usage, restricted to the
  // files insights actually reads (<= INSIGHTS_MAX_FILE_BYTES), preserving the original scope.
  const addUsage = (sm: SessionMetaRecord, r: UsageRow, cost: number) => {
    const eff = effective(r);
    sm.effectiveTokens += eff;
    sm.cost += cost;
    sm.models[r.model] = (sm.models[r.model] ?? 0) + eff;
  };
  const liveInsight = dedupUsage(parts.insightUsage);
  const insightDropped = settleUsage(liveInsight, archive.insight, (k) => {
    const i = archive.usageIndex.get(k);
    return i === undefined ? -1 : archive.insightOfUsage[i];
  });
  for (const r of liveInsight) {
    if (r.dedupKey === ':') continue; // matches the original `key !== ':' && usage` guard
    const sm = sessionsMeta.get(r.sessionId);
    if (sm) addUsage(sm, r, sessionCost(r));
  }
  for (const [sessionId, list] of archive.insightBySession) {
    const sm = sessionsMeta.get(sessionId);
    if (!sm) continue;
    for (const j of list) if (!insightDropped[j]) addUsage(sm, archive.insight[j], archive.insightCost[j]);
  }

  // ---- history rows: dedup across files, then roll up per session ----
  const limitHits = dedupBy(limitHitRows, (r) => r.key);
  const rateLimitSnaps = dedupBy(rateLimitRows, (r) => r.key);
  const lineChanges = dedupBy(lineChangeRows, (r) => r.key);
  const prLinks = dedupBy(prLinkRows, (r) => r.url);
  const turns = dedupBy(parts.turnRows.concat(parts.relayedTurnRows), (r) => r.key);
  for (const r of lineChanges) {
    const sm = sessionsMeta.get(r.sessionId);
    if (!sm) continue;
    sm.linesAdded += r.added;
    sm.linesRemoved += r.removed;
  }
  for (const r of turns) {
    const sm = sessionsMeta.get(r.sessionId);
    if (sm) sm.activeMs += r.durationMs;
  }
  for (const r of prLinks) {
    const sm = sessionsMeta.get(r.sessionId);
    if (sm) sm.prUrls.push(r.url);
  }
  for (const [sessionId, sm] of sessionsMeta) {
    const title = customTitle.get(sessionId) ?? aiTitle.get(sessionId);
    if (title) sm.title = title;
  }

  // ---- search corpus ----
  const searchCorpus = new Map<string, string>();
  for (const c of corpusRows) {
    let existing = searchCorpus.get(c.sessionId) ?? '';
    for (const snippet of c.snippets) {
      if (existing.length >= CORPUS_CAP) break;
      existing = existing ? existing + ' ' + snippet : snippet;
    }
    searchCorpus.set(c.sessionId, existing);
  }

  return {
    events,
    insights: {
      toolCalls, toolResults, taskSpawns, sessionsMeta, searchCorpus,
      limitHits, rateLimitSnaps, lineChanges, prLinks, turns,
    },
  };
}
