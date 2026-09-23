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
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = key(r);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out.sort((a, b) => a.ts - b.ts);
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

export interface MergeResult {
  events: UsageEvent[];
  insights: InsightsData;
}

export function mergeRows(files: FileRows[], sessionMetas: any[]): MergeResult {
  // ---- usage events (every file) ----
  const allUsage: UsageRow[] = [];
  // ---- usage restricted to insight-eligible files, for per-session token/cost ----
  const insightUsage: UsageRow[] = [];

  const toolCallRows: ToolCallRow[] = [];
  const taskSpawnRows: TaskSpawnRow[] = [];
  const sessionPartials: SessionPartialRow[] = [];
  const corpusRows: CorpusRow[] = [];
  const limitHitRows: LimitHitRow[] = [];
  const rateLimitRows: RateLimitSnapRow[] = [];
  const lineChangeRows: LineChangeRow[] = [];
  const prLinkRows: PrLinkRow[] = [];
  const turnRows: TurnRow[] = [];
  // Titles carry no timestamp: a later record (file order, then line order) wins,
  // and a user's custom rename beats Claude's generated ai-title.
  const customTitle = new Map<string, string>();
  const aiTitle = new Map<string, string>();
  const toolResults = new Map<string, ToolResultRecord>();
  const resultBySession = new Map<string, string | null>(); // `${toolId}|${sessionId}` -> agentId
  const nonErrorResultIds = new Set<string>();

  for (const f of files) {
    for (const u of f.usage) {
      allUsage.push(u);
      if (!f.insightsSkipped) insightUsage.push(u);
    }
    // Limit hits and rate-limit snapshots are cheap and matter for every file.
    if (f.limitHits) limitHitRows.push(...f.limitHits);
    if (f.rateLimitSnaps) rateLimitRows.push(...f.rateLimitSnaps);
    if (f.insightsSkipped) continue;
    if (f.lineChanges) lineChangeRows.push(...f.lineChanges);
    if (f.prLinks) prLinkRows.push(...f.prLinks);
    if (f.turns) turnRows.push(...f.turns);
    for (const t of [...(f.titles ?? [])].sort((a, b) => a.seq - b.seq)) {
      (t.kind === 'custom' ? customTitle : aiTitle).set(t.sessionId, t.title);
    }
    toolCallRows.push(...f.toolCalls);
    taskSpawnRows.push(...f.taskSpawns);
    sessionPartials.push(...f.sessions);
    corpusRows.push(...f.corpus);
    for (const r of f.toolResults) {
      // Last write wins, matching the original `toolResults.set(...)` per line.
      toolResults.set(r.toolId, {
        id: r.toolId, is_error: r.isError, rejected: r.rejected, errorText: r.errorText,
      });
      if (r.agentIdFromResult) resultBySession.set(`${r.toolId}|${r.sessionId}`, r.agentIdFromResult);
      // A rejected call never ran: a declined Codex `git commit` is not a commit.
      if (!r.isError && !r.rejected) nonErrorResultIds.add(r.toolId);
    }
  }

  const projectPathOf = buildProjectPathResolver(sessionPartials, sessionMetas);

  const dedupedUsage = dedupUsage(allUsage);
  const events = dedupedUsage.map((r) => toEvent(r, projectPathOf)).sort((a, b) => a.ts - b.ts);

  // ---- tool calls: distinct by tool_use id ----
  const seenTool = new Set<string>();
  const toolCalls: ToolCallRecord[] = [];
  for (const t of toolCallRows) {
    if (t.toolId) {
      if (seenTool.has(t.toolId)) continue;
      seenTool.add(t.toolId);
    }
    toolCalls.push({
      ts: t.ts, sessionId: t.sessionId, name: t.name, isSidechain: t.isSidechain,
      mcpServer: t.mcpServer, filePath: t.filePath, gitBranch: t.gitBranch,
      projectPath: projectPathOf(t.source, t.sessionId, t.projectPath), id: t.toolId, source: t.source,
    });
  }
  toolCalls.sort((a, b) => a.ts - b.ts);

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
    if (sm) sm.assistantMsgs = keys.size;
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
  for (const t of toolCalls) {
    const sm = sessionsMeta.get(t.sessionId);
    if (sm) sm.toolCallCount++;
  }
  for (const t of taskSpawns) {
    const sm = sessionsMeta.get(t.sessionId);
    if (sm) sm.subagentSpawns++;
  }

  // Per-session tokens and cost from globally deduped usage, restricted to the
  // files insights actually reads (<= INSIGHTS_MAX_FILE_BYTES), preserving the original scope.
  for (const r of dedupUsage(insightUsage)) {
    if (r.dedupKey === ':') continue; // matches the original `key !== ':' && usage` guard
    const sm = sessionsMeta.get(r.sessionId);
    if (!sm) continue;
    const eff = effective(r);
    sm.effectiveTokens += eff;
    sm.cost += estimateCost(r.model, {
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheCreateTokens: r.cacheCreateTokens,
      cacheReadTokens: 0,
    });
    sm.models[r.model] = (sm.models[r.model] ?? 0) + eff;
  }

  // ---- history rows: dedup across files, then roll up per session ----
  const limitHits = dedupBy(limitHitRows, (r) => r.key);
  const rateLimitSnaps = dedupBy(rateLimitRows, (r) => r.key);
  const lineChanges = dedupBy(lineChangeRows, (r) => r.key);
  const prLinks = dedupBy(prLinkRows, (r) => r.url);
  const turns = dedupBy(turnRows, (r) => r.key);
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
