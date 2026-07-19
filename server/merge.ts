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
 */
import { estimateCost } from './pricing.ts';
import type { UsageEvent } from './scan.ts';
import type {
  CorpusRow, FileRows, SessionPartialRow, TaskSpawnRow, ToolCallRow, UsageRow,
} from './scan-pass.ts';
import type {
  InsightsData, SessionMetaRecord, TaskSpawnRecord, ToolCallRecord, ToolResultRecord,
} from './insights-scan.ts';

const CORPUS_CAP = 20 * 1024;

function effective(r: UsageRow): number {
  return r.inputTokens + r.outputTokens + r.cacheCreateTokens;
}

function toEvent(r: UsageRow, sessionPathMap: Map<string, string>): UsageEvent {
  // The session-meta override is applied here rather than at parse time so cached
  // rows stay valid when usage-data/session-meta/*.json changes.
  const projectPath =
    r.source === 'code' && r.sessionId ? sessionPathMap.get(r.sessionId) ?? r.projectPathRaw : r.projectPathRaw;
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
  };
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
  const sessionPathMap = new Map<string, string>();
  for (const s of sessionMetas) {
    if (s?.session_id && s?.project_path) sessionPathMap.set(s.session_id, s.project_path);
  }

  // ---- usage events (every file) ----
  const allUsage: UsageRow[] = [];
  // ---- usage restricted to insight-eligible files, for per-session token/cost ----
  const insightUsage: UsageRow[] = [];

  const toolCallRows: ToolCallRow[] = [];
  const taskSpawnRows: TaskSpawnRow[] = [];
  const sessionPartials: SessionPartialRow[] = [];
  const corpusRows: CorpusRow[] = [];
  const toolResults = new Map<string, ToolResultRecord>();
  const resultBySession = new Map<string, string | null>(); // `${toolId}|${sessionId}` -> agentId
  const nonErrorResultIds = new Set<string>();

  for (const f of files) {
    for (const u of f.usage) {
      allUsage.push(u);
      if (!f.insightsSkipped) insightUsage.push(u);
    }
    if (f.insightsSkipped) continue;
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
      if (!r.isError) nonErrorResultIds.add(r.toolId);
    }
  }

  const dedupedUsage = dedupUsage(allUsage);
  const events = dedupedUsage.map((r) => toEvent(r, sessionPathMap)).sort((a, b) => a.ts - b.ts);

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
      projectPath: t.projectPath, id: t.toolId, source: t.source,
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
      completed: agentId !== null, gitBranch: t.gitBranch, projectPath: t.projectPath,
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
        firstPrompt: '', gitBranch: p.gitBranch, projectPath: p.projectPath,
        models: {}, effectiveTokens: 0, cost: 0, file: p.file,
        agentId: p.agentId ?? undefined, source: p.source,
      };
      sessionsMeta.set(p.sessionId, sm);
    } else if (!p.fileIsSidechain && sm.isSidechain) {
      // A parent-session file is authoritative and clears a flag set by a subagent file.
      sm.isSidechain = false;
    }
    if (p.firstTs < sm.firstTs) sm.firstTs = p.firstTs;
    if (p.lastTs > sm.lastTs) sm.lastTs = p.lastTs;
    if (p.gitBranch && !sm.gitBranch) sm.gitBranch = p.gitBranch;
    if (p.firstPrompt && !sm.firstPrompt) sm.firstPrompt = p.firstPrompt;
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
  // files insights actually reads (<= 5 MB), preserving the original scope.
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
    insights: { toolCalls, toolResults, taskSpawns, sessionsMeta, searchCorpus },
  };
}
