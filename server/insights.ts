/**
 * insights.ts
 * Pure builder functions (no I/O) for the analytics/insights endpoints.
 * All functions take (d: InsightsData, days: number, now?: number).
 */

import type { InsightsData, ToolCallRecord, ToolResultRecord } from './insights-scan.ts';
import type { UsageSource } from './scan.ts';
import { estimateCost } from './pricing.ts';

const DAY_MS = 24 * 3600_000;

/**
 * Narrow InsightsData to a single surface so the Insights tab honors the
 * Code/Cowork toggle. Filters tool calls, task spawns and session metadata by
 * `source`; `toolResults` (keyed by tool_use_id) and `searchCorpus` are left
 * whole — builders join them via the already-filtered tool calls / sessions,
 * so leftover entries are simply never looked up. 'all' is a pass-through.
 */
export function scopeInsights(d: InsightsData, source: 'all' | UsageSource): InsightsData {
  if (source === 'all') return d;
  const sessionsMeta = new Map(
    [...d.sessionsMeta].filter(([, sm]) => sm.source === source)
  );
  return {
    toolCalls: d.toolCalls.filter((tc) => tc.source === source),
    toolResults: d.toolResults,
    taskSpawns: d.taskSpawns.filter((t) => t.source === source),
    sessionsMeta,
    searchCorpus: d.searchCorpus,
  };
}

function cutoff(days: number, now = Date.now()): number {
  return now - days * DAY_MS;
}

function localDateKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyError(text: string, rejected: boolean): string {
  if (rejected) return 'rejected';
  if (!text) return 'other';
  if (/does not exist|cannot find path|no such file/i.test(text)) return 'file-not-found';
  if (/has not been read/i.test(text)) return 'not-read';
  if (/exit code [1-9]/i.test(text)) return 'exit-code';
  if (/APIResponseError|status.{0,4}4\d\d|status.{0,4}5\d\d/i.test(text)) return 'api-error';
  if (/timed?\s?out/i.test(text)) return 'timeout';
  return 'other';
}

// ---------------------------------------------------------------------------
// buildErrors
// ---------------------------------------------------------------------------

export function buildErrors(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);
  const filtered = d.toolCalls.filter((tc) => tc.ts >= from);

  let totalCalls = 0;
  let errors = 0;
  const categories: Record<string, number> = {};
  const perToolMap = new Map<string, { calls: number; errors: number }>();
  const trendMap = new Map<string, { calls: number; errors: number }>();

  for (const tc of filtered) {
    totalCalls++;
    const result = d.toolResults.get(tc.id);
    const isError = result ? (result.is_error || result.rejected) : false;

    const dateKey = localDateKey(tc.ts);
    let dayBucket = trendMap.get(dateKey);
    if (!dayBucket) {
      dayBucket = { calls: 0, errors: 0 };
      trendMap.set(dateKey, dayBucket);
    }
    dayBucket.calls++;

    let toolEntry = perToolMap.get(tc.name);
    if (!toolEntry) {
      toolEntry = { calls: 0, errors: 0 };
      perToolMap.set(tc.name, toolEntry);
    }
    toolEntry.calls++;

    if (isError) {
      errors++;
      dayBucket.errors++;
      toolEntry.errors++;
      const cat = classifyError(result?.errorText ?? '', result?.rejected ?? false);
      categories[cat] = (categories[cat] ?? 0) + 1;
    }
  }

  const perTool = [...perToolMap.entries()]
    .map(([name, v]) => ({
      name,
      calls: v.calls,
      errors: v.errors,
      errorRate: v.calls > 0 ? v.errors / v.calls : 0,
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 12);

  const trend = [...trendMap.entries()]
    .map(([date, v]) => ({ date, calls: v.calls, errors: v.errors }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalCalls,
    errors,
    errorRate: totalCalls > 0 ? errors / totalCalls : 0,
    categories,
    perTool,
    trend,
  };
}

// ---------------------------------------------------------------------------
// buildRetries
// ---------------------------------------------------------------------------

export function buildRetries(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);
  const editWriteTools = new Set(['Edit', 'Write', 'MultiEdit']);

  // Group Edit/Write calls by session
  const sessionCalls = new Map<string, ToolCallRecord[]>();
  let totalEdits = 0;

  for (const tc of d.toolCalls) {
    if (tc.ts < from) continue;
    if (!editWriteTools.has(tc.name)) continue;
    totalEdits++;
    let arr = sessionCalls.get(tc.sessionId);
    if (!arr) {
      arr = [];
      sessionCalls.set(tc.sessionId, arr);
    }
    arr.push(tc);
  }

  // One-shot rate: Edit/Write with no error result
  let oneShotOk = 0;
  let retried = 0;
  let wastedTokens = 0;
  let wastedCost = 0;

  // Build per-session token timeline for wasted tokens approximation
  // Map sessionId → sorted assistant events by ts
  const sessionAssistantTokens = new Map<string, Array<{ ts: number; eff: number; model: string }>>();
  for (const sm of d.sessionsMeta.values()) {
    if (!sessionAssistantTokens.has(sm.sessionId)) {
      sessionAssistantTokens.set(sm.sessionId, []);
    }
  }
  // We don't have per-turn assistant token timeline from insights-scan,
  // so we approximate wastedTokens as sm.effectiveTokens / sm.assistantMsgs per error

  for (const [sessionId, calls] of sessionCalls) {
    const sm = d.sessionsMeta.get(sessionId);
    const avgTokensPerTurn = sm && sm.assistantMsgs > 0 ? sm.effectiveTokens / sm.assistantMsgs : 0;
    const avgModel = sm ? Object.entries(sm.models).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown' : 'unknown';
    const avgCostPerTurn = avgTokensPerTurn > 0
      ? estimateCost(avgModel, { inputTokens: avgTokensPerTurn * 0.6, outputTokens: avgTokensPerTurn * 0.3, cacheCreateTokens: avgTokensPerTurn * 0.1, cacheReadTokens: 0 })
      : 0;

    // Detect retries: errored call followed by same tool + same filePath
    const seen = new Map<string, boolean>(); // key=tool+filepath, value=hadError
    for (const tc of calls) {
      const result: ToolResultRecord | undefined = d.toolResults.get(tc.id);
      const isError = result ? (result.is_error || result.rejected) : false;
      const key = `${tc.name}::${tc.filePath ?? ''}`;

      if (!isError) {
        if (seen.get(key) === true) {
          // This is a retry that succeeded
          retried++;
        }
        oneShotOk++;
        seen.set(key, false);
      } else {
        wastedTokens += avgTokensPerTurn;
        wastedCost += avgCostPerTurn;
        seen.set(key, true);
      }
    }
  }

  return {
    oneShotRate: totalEdits > 0 ? oneShotOk / totalEdits : 1,
    totalEdits,
    retried,
    wastedTokens: Math.round(wastedTokens),
    wastedCost,
  };
}

// ---------------------------------------------------------------------------
// buildLanguages
// ---------------------------------------------------------------------------

const EXT_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  py: 'Python',
  rs: 'Rust',
  go: 'Go',
  java: 'Java',
  cs: 'C#',
  css: 'CSS', scss: 'CSS', sass: 'CSS',
  html: 'HTML', htm: 'HTML',
  json: 'JSON',
  md: 'Markdown', mdx: 'Markdown',
  yml: 'YAML', yaml: 'YAML',
  sql: 'SQL',
  sh: 'Shell', bash: 'Shell', ps1: 'Shell', psm1: 'Shell', psd1: 'Shell',
};

export function buildLanguages(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);
  const editWriteTools = new Set(['Edit', 'Write', 'MultiEdit']);
  const readTools = new Set(['Read', 'ReadFile']);

  const langMap = new Map<string, { edits: number; reads: number }>();

  for (const tc of d.toolCalls) {
    if (tc.ts < from) continue;
    if (!tc.filePath) continue;

    const isEdit = editWriteTools.has(tc.name);
    const isRead = readTools.has(tc.name);
    if (!isEdit && !isRead) continue;

    const ext = (tc.filePath.split('.').pop() ?? '').toLowerCase();
    const lang = EXT_MAP[ext] ?? 'Other';

    let entry = langMap.get(lang);
    if (!entry) {
      entry = { edits: 0, reads: 0 };
      langMap.set(lang, entry);
    }
    if (isEdit) entry.edits++;
    if (isRead) entry.reads++;
  }

  return [...langMap.entries()]
    .map(([language, v]) => ({ language, edits: v.edits, reads: v.reads }))
    .sort((a, b) => (b.edits + b.reads) - (a.edits + a.reads));
}

// ---------------------------------------------------------------------------
// buildBranches
// ---------------------------------------------------------------------------

export function buildBranches(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);
  // Key by repo + branch so the same branch name (e.g. "main") in different repos
  // stays separate and each row can be attributed to its repository.
  const branchMap = new Map<string, { branch: string; repo: string; effectiveTokens: number; cost: number; sessions: Set<string> }>();

  for (const sm of d.sessionsMeta.values()) {
    if (sm.lastTs < from) continue;
    if (!sm.gitBranch) continue;

    const repo = sm.projectPath
      ? sm.projectPath.split(/[\\/]/).filter(Boolean).pop() ?? sm.projectPath
      : 'unknown';
    const key = `${repo} ${sm.gitBranch}`;

    let entry = branchMap.get(key);
    if (!entry) {
      entry = { branch: sm.gitBranch, repo, effectiveTokens: 0, cost: 0, sessions: new Set() };
      branchMap.set(key, entry);
    }
    entry.effectiveTokens += sm.effectiveTokens;
    entry.cost += sm.cost;
    entry.sessions.add(sm.sessionId);
  }

  return [...branchMap.values()]
    .map((v) => ({
      branch: v.branch,
      repo: v.repo,
      effectiveTokens: v.effectiveTokens,
      cost: v.cost,
      sessions: v.sessions.size,
    }))
    .sort((a, b) => b.effectiveTokens - a.effectiveTokens)
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// buildMcp
// ---------------------------------------------------------------------------

export function buildMcp(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);
  let builtinCalls = 0;
  let mcpCalls = 0;
  const serverMap = new Map<string, { calls: number; errors: number }>();

  for (const tc of d.toolCalls) {
    if (tc.ts < from) continue;
    const result = d.toolResults.get(tc.id);
    const isError = result ? (result.is_error || result.rejected) : false;

    if (tc.mcpServer) {
      mcpCalls++;
      let entry = serverMap.get(tc.mcpServer);
      if (!entry) {
        entry = { calls: 0, errors: 0 };
        serverMap.set(tc.mcpServer, entry);
      }
      entry.calls++;
      if (isError) entry.errors++;
    } else {
      builtinCalls++;
    }
  }

  const perServer = [...serverMap.entries()]
    .map(([server, v]) => ({ server, calls: v.calls, errors: v.errors }))
    .sort((a, b) => b.calls - a.calls);

  return { builtinCalls, mcpCalls, perServer };
}

// ---------------------------------------------------------------------------
// buildComplexity
// ---------------------------------------------------------------------------

export interface ComplexityPoint {
  sessionId: string;
  project: string;
  turns: number;
  toolCalls: number;
  subagents: number;
  effectiveTokens: number;
  durationMin: number;
  date: string;
}

export function buildComplexity(d: InsightsData, days: number, now = Date.now()): ComplexityPoint[] {
  const from = cutoff(days, now);

  const results: ComplexityPoint[] = [];
  for (const sm of d.sessionsMeta.values()) {
    if (sm.isSidechain) continue;
    if (sm.lastTs < from) continue;

    const projectName = sm.projectPath
      ? sm.projectPath.split(/[\\\/]/).filter(Boolean).pop() ?? sm.projectPath
      : 'unknown';

    results.push({
      sessionId: sm.sessionId,
      project: projectName,
      turns: sm.turns,
      toolCalls: sm.toolCallCount,
      subagents: sm.subagentSpawns,
      effectiveTokens: sm.effectiveTokens,
      durationMin: sm.lastTs > sm.firstTs ? Math.round((sm.lastTs - sm.firstTs) / 60_000) : 0,
      date: localDateKey(sm.firstTs),
    });
  }

  return results
    .sort((a, b) => b.effectiveTokens - a.effectiveTokens)
    .slice(0, 200);
}

// ---------------------------------------------------------------------------
// buildYield
// ---------------------------------------------------------------------------

export function buildYield(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);

  let committed = 0;
  let tokensCommitted = 0;
  let uncommitted = 0;
  let tokensUncommitted = 0;

  const topUncommitted: Array<{ project: string; date: string; effectiveTokens: number }> = [];

  for (const sm of d.sessionsMeta.values()) {
    if (sm.isSidechain) continue;
    if (sm.lastTs < from) continue;

    const projectName = sm.projectPath
      ? sm.projectPath.split(/[\\\/]/).filter(Boolean).pop() ?? sm.projectPath
      : 'unknown';

    if (sm.committed) {
      committed++;
      tokensCommitted += sm.effectiveTokens;
    } else {
      uncommitted++;
      tokensUncommitted += sm.effectiveTokens;
      topUncommitted.push({ project: projectName, date: localDateKey(sm.firstTs), effectiveTokens: sm.effectiveTokens });
    }
  }

  const total = committed + uncommitted;

  return {
    committed,
    tokensCommitted,
    uncommitted,
    tokensUncommitted,
    rate: total > 0 ? committed / total : 0,
    topUncommitted: topUncommitted
      .sort((a, b) => b.effectiveTokens - a.effectiveTokens)
      .slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// buildRejections
// ---------------------------------------------------------------------------

export function buildRejections(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);
  let total = 0;
  const perToolMap = new Map<string, { calls: number; rejections: number }>();

  for (const tc of d.toolCalls) {
    if (tc.ts < from) continue;
    const result = d.toolResults.get(tc.id);
    const isRejected = result ? result.rejected : false;

    let entry = perToolMap.get(tc.name);
    if (!entry) {
      entry = { calls: 0, rejections: 0 };
      perToolMap.set(tc.name, entry);
    }
    entry.calls++;

    if (isRejected) {
      total++;
      entry.rejections++;
    }
  }

  const perTool = [...perToolMap.entries()]
    .filter(([, v]) => v.rejections > 0)
    .map(([name, v]) => ({ name, calls: v.calls, rejections: v.rejections }))
    .sort((a, b) => b.rejections - a.rejections);

  return { total, perTool };
}

// ---------------------------------------------------------------------------
// buildSubagentStats
// ---------------------------------------------------------------------------

export function buildSubagentStats(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);

  const spawnsInWindow = d.taskSpawns.filter((t) => t.ts >= from);
  const spawns = spawnsInWindow.length;

  const byType: Record<string, number> = {};
  const byModel: Record<string, number> = {};

  for (const s of spawnsInWindow) {
    byType[s.subagentType] = (byType[s.subagentType] ?? 0) + 1;
    const model = s.model ?? 'unknown';
    byModel[model] = (byModel[model] ?? 0) + 1;
  }

  // Sessions with at least one subagent spawn (non-sidechain)
  let sessionsWithSpawns = 0;
  let totalNonSidechainSessions = 0;
  for (const sm of d.sessionsMeta.values()) {
    if (sm.isSidechain) continue;
    if (sm.lastTs < from) continue;
    totalNonSidechainSessions++;
    if (sm.subagentSpawns > 0) sessionsWithSpawns++;
  }

  return {
    spawns,
    byType,
    byModel,
    avgPerSession: sessionsWithSpawns > 0 ? spawns / sessionsWithSpawns : 0,
    delegationRate: totalNonSidechainSessions > 0 ? sessionsWithSpawns / totalNonSidechainSessions : 0,
  };
}

// ---------------------------------------------------------------------------
// buildFileChurn — most-edited files (Edit/Write/MultiEdit/NotebookEdit)
// ---------------------------------------------------------------------------

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

export interface FileChurnEntry {
  path: string;
  name: string;
  edits: number;
  projectName: string;
  lastTs: number;
}

export function buildFileChurn(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);
  const map = new Map<string, { path: string; edits: number; lastTs: number; projectPath: string }>();
  for (const tc of d.toolCalls) {
    if (tc.ts < from) continue;
    if (!tc.filePath || !EDIT_TOOLS.has(tc.name)) continue;
    let e = map.get(tc.filePath);
    if (!e) {
      e = { path: tc.filePath, edits: 0, lastTs: tc.ts, projectPath: tc.projectPath };
      map.set(tc.filePath, e);
    }
    e.edits++;
    if (tc.ts > e.lastTs) e.lastTs = tc.ts;
  }
  const files: FileChurnEntry[] = [...map.values()]
    .map((v) => ({
      path: v.path,
      name: v.path.split(/[\\/]/).filter(Boolean).pop() ?? v.path,
      edits: v.edits,
      projectName: v.projectPath.split(/[\\/]/).filter(Boolean).pop() ?? '',
      lastTs: v.lastTs,
    }))
    .sort((a, b) => b.edits - a.edits)
    .slice(0, 25);
  const totalEdits = [...map.values()].reduce((s, v) => s + v.edits, 0);
  return { totalEdits, uniqueFiles: map.size, files };
}
