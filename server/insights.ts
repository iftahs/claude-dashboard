/**
 * insights.ts
 * Pure builder functions (no I/O) for the analytics/insights endpoints.
 * All functions take (d: InsightsData, days: number, now?: number); `now` defaults
 * to Date.now(), but the routes pass computedAt so memoised output shares its clock.
 *
 * Two platform rules live here, not the UI: a REJECTION is never a failure (kept
 * apart from `is_error` everywhere), and Codex edits never RETRY (buildRetries
 * measures Claude edits only).
 */

import type { InsightsData, SessionMetaRecord, ToolCallRecord, ToolResultRecord } from './insights-scan.ts';
import { sourceMatches, type SourceFilter } from './aggregate.ts';
import { estimateCost } from './pricing.ts';
import { GUARDIAN_DENY_TOOL } from './scan-pass-codex.ts';
import type { UsageSource } from './scan.ts';

const DAY_MS = 24 * 3600_000;

/** TaskSpawnRecord.subagentType of a Codex guardian auto-review (one row per verdict). */
export const GUARDIAN_REVIEW_TYPE = 'guardian_review';

/** The platform a surface belongs to: Claude = Code + Cowork, Codex = the ChatGPT desktop agent. */
export type InsightPlatform = 'claude' | 'codex';

export function platformOf(source: UsageSource): InsightPlatform {
  return source === 'codex' ? 'codex' : 'claude';
}

/**
 * Narrow InsightsData to a single surface so the Insights tab honors the
 * Code/Cowork toggle. Filters tool calls, task spawns and session metadata by
 * `source`; `toolResults` (keyed by tool_use_id) and `searchCorpus` are left
 * whole — builders join them via the already-filtered tool calls / sessions,
 * so leftover entries are simply never looked up. 'all' is a pass-through.
 */
export function scopeInsights(d: InsightsData, source: SourceFilter): InsightsData {
  if (source === 'all') return d;
  const sessionsMeta = new Map(
    [...d.sessionsMeta].filter(([, sm]) => sourceMatches(sm.source, source))
  );
  return {
    toolCalls: d.toolCalls.filter((tc) => sourceMatches(tc.source, source)),
    toolResults: d.toolResults,
    taskSpawns: d.taskSpawns.filter((t) => sourceMatches(t.source, source)),
    sessionsMeta,
    searchCorpus: d.searchCorpus,
    limitHits: d.limitHits.filter((r) => sourceMatches(r.source, source)),
    // Rate-limit snapshots are Codex account state, not per-source usage.
    rateLimitSnaps: source === 'codex' ? d.rateLimitSnaps : [],
    lineChanges: d.lineChanges.filter((r) => sourceMatches(r.source, source)),
    prLinks: d.prLinks.filter((r) => sourceMatches(r.source, source)),
    turns: d.turns.filter((r) => sourceMatches(r.source, source)),
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

/** Last path segment ('' for an empty path). */
function lastSegment(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? '';
}

/** The repo a Claude Code worktree (`<repo>/.claude/worktrees/<name>/…`) belongs to, or null otherwise — its own folder name is a throwaway id, never the project. */
export function worktreeRepo(p: string): string | null {
  const m = /^(.*?)[\\/]\.claude[\\/]worktrees[\\/][^\\/]+/i.exec(p);
  return m ? lastSegment(m[1]) || null : null;
}

/** Project label: the real cwd when the log recorded one, else the decoded project path (Codex's projectPath already is its cwd). */
function projectName(sm: SessionMetaRecord): string {
  const p = sm.cwd || sm.projectPath;
  return worktreeRepo(p) ?? (lastSegment(p) || 'unknown');
}

/** `https://github.com/acme/web.git` → `web`; '' when there is no usable segment. */
export function repoNameFromUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '').replace(/\.git$/i, '');
  // scp-style remotes (git@host:org/repo) use ':' before the path.
  return lastSegment(trimmed.replace(/^[^/]*:(?!\/\/)/, '/'));
}

/** Non-sidechain sessions active in the window. */
function sessionsInWindow(d: InsightsData, from: number): SessionMetaRecord[] {
  const out: SessionMetaRecord[] = [];
  for (const sm of d.sessionsMeta.values()) {
    if (sm.isSidechain || sm.lastTs < from) continue;
    out.push(sm);
  }
  return out;
}

/** Could this session have committed? A git branch/remote, or any commit/push/PR — activity matters for Codex, whose scratch-folder threads still commit into a real repo. */
export function hasRepo(sm: SessionMetaRecord): boolean {
  return !!(sm.gitBranch || sm.repoUrl || sm.gitCommits > 0 || sm.gitPushes > 0 || sm.prUrls.length > 0);
}

type CallOutcome = 'ok' | 'failed' | 'rejected';

/** A call is rejected (it never ran), failed (it ran and errored) or ok — never two of them. */
function outcomeOf(r: ToolResultRecord | undefined): CallOutcome {
  if (!r) return 'ok';
  if (r.rejected) return 'rejected';
  return r.is_error ? 'failed' : 'ok';
}

/** Nearest-rank percentile of an ascending array; null when it is empty. */
function percentile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[idx];
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/** Tool names a Codex CommandExecution maps onto (scan-pass-codex COMMAND_NAMES + the shell fallback). */
const CODEX_COMMAND_TOOLS = new Set(['Bash', 'Read', 'Grep', 'LS']);
/** Tool names a Codex FileChange maps onto (scan-pass-codex CHANGE_NAMES). */
const CODEX_PATCH_TOOLS = new Set(['Edit', 'Write', 'Delete']);

/** Category of a FAILED call (rejections never reach here); text patterns first (most to least specific), then the call itself when none match. */
export function classifyError(
  text: string,
  tool?: Pick<ToolCallRecord, 'name' | 'source' | 'mcpServer'>,
): string {
  const t = text ?? '';
  if (t) {
    if (/\bhit your \w+ limit\b|usage_limit_exceeded|\brate[_ ]limit/i.test(t)) return 'usage-limit';
    // A hook, the permission layer or a sandbox refused to run the call.
    if (/hook error|\bBlocked: |\bis blocked\b|refusing to run/i.test(t)) return 'blocked';
    if (/has not been read|modified since read/i.test(t)) return 'not-read';
    if (/string to replace not found|no changes to make|found \d+ matches of the string/i.test(t)) return 'edit-mismatch';
    if (/does not exist|cannot find path|no such file|ENOENT/i.test(t)) return 'file-not-found';
    if (/exceeds maximum allowed tokens/i.test(t)) return 'too-large';
    if (/timed?\s?out|deadline exceeded/i.test(t)) return 'timeout';
    if (/regex parse error|does not match required schema|InputValidationError|invalid (input|arguments?)\b/i.test(t)) return 'invalid-input';
    if (/exit code [1-9]/i.test(t)) return 'exit-code';
    if (/APIResponseError|status.{0,4}[45]\d\d/i.test(t)) return 'api-error';
    if (/socket hang up|ECONNRESET|ECONNREFUSED|failed to fetch|certificate/i.test(t)) return 'network';
  }
  if (tool?.source === 'codex') {
    if (CODEX_PATCH_TOOLS.has(tool.name)) return 'patch-failed';
    if (CODEX_COMMAND_TOOLS.has(tool.name)) return 'exit-code';
  }
  if (tool?.mcpServer) return 'mcp-error';
  return 'other';
}

// ---------------------------------------------------------------------------
// buildErrors — failures only; rejections are counted beside them
// ---------------------------------------------------------------------------

export function buildErrors(d: InsightsData, days: number, now = Date.now(), perToolLimit = 12) {
  const from = cutoff(days, now);

  let totalCalls = 0;
  let errors = 0;
  let rejections = 0;
  const categories: Record<string, number> = {};
  const perToolMap = new Map<string, { calls: number; errors: number }>();
  const trendMap = new Map<string, { calls: number; errors: number }>();

  for (const tc of d.toolCalls) {
    if (tc.ts < from) continue;
    totalCalls++;
    const result = d.toolResults.get(tc.id);
    const outcome = outcomeOf(result);

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

    if (outcome === 'rejected') {
      rejections++;
    } else if (outcome === 'failed') {
      errors++;
      dayBucket.errors++;
      toolEntry.errors++;
      const cat = classifyError(result?.errorText ?? '', tc);
      categories[cat] = (categories[cat] ?? 0) + 1;
    }
  }

  // Only tools that failed: the Tool usage panel already ranks every tool by volume.
  const failing = [...perToolMap.entries()].filter(([, v]) => v.errors > 0);
  const perTool = failing
    .map(([name, v]) => ({
      name,
      calls: v.calls,
      errors: v.errors,
      errorRate: v.calls > 0 ? v.errors / v.calls : 0,
    }))
    .sort((a, b) => b.errors - a.errors || b.calls - a.calls)
    .slice(0, perToolLimit);

  const trend = [...trendMap.entries()]
    .map(([date, v]) => ({ date, calls: v.calls, errors: v.errors }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalCalls,
    /** Failed calls — rejections excluded. */
    errors,
    errorRate: totalCalls > 0 ? errors / totalCalls : 0,
    rejections,
    rejectionRate: totalCalls > 0 ? rejections / totalCalls : 0,
    categories,
    perTool,
    perToolTotal: failing.length, // real row count — `perTool` above is clipped
    trend,
  };
}

export interface ToolShare {
  name: string;
  count: number;
}

export function buildToolUsage(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);
  const counts = new Map<string, number>();
  let totalCalls = 0;
  for (const tc of d.toolCalls) {
    // A guardian deny is the reviewer's verdict, not a tool Codex called.
    if (tc.ts < from || tc.name === GUARDIAN_DENY_TOOL) continue;
    counts.set(tc.name, (counts.get(tc.name) ?? 0) + 1);
    totalCalls++;
  }
  const tools: ToolShare[] = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  return { rangeFrom: from, rangeTo: now, totalCalls, tools };
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
  let codexEdits = 0;

  for (const tc of d.toolCalls) {
    if (tc.ts < from) continue;
    if (!editWriteTools.has(tc.name)) continue;
    // A Codex patch applies, fails or is declined — the next patch is a new decision, never a retry of this one (counting them would pin the rate at 100%).
    if (tc.source === 'codex') {
      codexEdits++;
      continue;
    }
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

  // No per-turn assistant token timeline in the insights rows, so wastedTokens approximates sm.effectiveTokens / sm.assistantMsgs per error.
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
      const outcome = outcomeOf(d.toolResults.get(tc.id));
      // A declined edit never ran: not an attempt, a failure or a waste.
      if (outcome === 'rejected') continue;
      totalEdits++;
      const key = `${tc.name}::${tc.filePath ?? ''}`;

      if (outcome === 'ok') {
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
    /** null with no Claude edits in the window (always under Codex) — never a vacuous 100%. */
    oneShotRate: totalEdits > 0 ? oneShotOk / totalEdits : null,
    totalEdits,
    retried,
    wastedTokens: Math.round(wastedTokens),
    wastedCost,
    /** Codex edits in the window, left out of every figure above (they cannot retry). */
    codexEdits,
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

export function buildBranches(d: InsightsData, days: number, now = Date.now(), limit = 10) {
  const from = cutoff(days, now);
  // Key by repo + branch so the same branch name (e.g. "main") in different repos
  // stays separate and each row can be attributed to its repository.
  const branchMap = new Map<string, { branch: string; repo: string; effectiveTokens: number; cost: number; sessions: Set<string> }>();

  for (const sm of d.sessionsMeta.values()) {
    if (sm.lastTs < from) continue;
    if (!sm.gitBranch) continue;

    // The remote names the repo when the log has one (Codex session_meta.git) — a Codex thread's cwd is often a scratch folder, not the repository.
    const repo = (sm.repoUrl && repoNameFromUrl(sm.repoUrl)) || projectName(sm);
    const key = `${repo}\u0000${sm.gitBranch}`;

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
    .slice(0, limit);
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
    // Failures only — a declined MCP call never reached the server.
    const failed = outcomeOf(d.toolResults.get(tc.id)) === 'failed';

    if (tc.mcpServer) {
      mcpCalls++;
      let entry = serverMap.get(tc.mcpServer);
      if (!entry) {
        entry = { calls: 0, errors: 0 };
        serverMap.set(tc.mcpServer, entry);
      }
      entry.calls++;
      if (failed) entry.errors++;
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
  /** Subagent spawns + guardian reviews (Codex) — the dot size. */
  subagents: number;
  effectiveTokens: number;
  durationMin: number;
  date: string;
  platform: InsightPlatform;
}

export function buildComplexity(d: InsightsData, days: number, now = Date.now(), limit = 200): ComplexityPoint[] {
  const from = cutoff(days, now);

  const results: ComplexityPoint[] = [];
  for (const sm of sessionsInWindow(d, from)) {
    results.push({
      sessionId: sm.sessionId,
      project: projectName(sm),
      turns: sm.turns,
      toolCalls: sm.toolCallCount,
      subagents: sm.subagentSpawns,
      effectiveTokens: sm.effectiveTokens,
      durationMin: sm.lastTs > sm.firstTs ? Math.round((sm.lastTs - sm.firstTs) / 60_000) : 0,
      date: localDateKey(sm.firstTs),
      platform: platformOf(sm.source),
    });
  }

  return results
    .sort((a, b) => b.effectiveTokens - a.effectiveTokens)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// buildYield — commit yield over the sessions that could commit
// ---------------------------------------------------------------------------

export function buildYield(d: InsightsData, days: number, now = Date.now(), limit = 10) {
  const from = cutoff(days, now);

  let sessions = 0;
  let noRepo = 0;
  let tokensNoRepo = 0;
  let committed = 0;
  let tokensCommitted = 0;
  let uncommitted = 0;
  let tokensUncommitted = 0;
  let prSessions = 0;
  let prCount = 0;
  let prOnlySessions = 0;

  const topUncommitted: Array<{ project: string; date: string; effectiveTokens: number }> = [];

  for (const sm of sessionsInWindow(d, from)) {
    sessions++;
    // A chat in a scratch folder never could commit; it is its own bucket, not a miss.
    if (!hasRepo(sm)) {
      noRepo++;
      tokensNoRepo += sm.effectiveTokens;
      continue;
    }
    if (sm.committed) {
      committed++;
      tokensCommitted += sm.effectiveTokens;
      if (sm.prUrls.length > 0) {
        prSessions++;
        prCount += sm.prUrls.length;
      }
    } else {
      if (sm.prUrls.length > 0) prOnlySessions++;
      uncommitted++;
      tokensUncommitted += sm.effectiveTokens;
      topUncommitted.push({ project: projectName(sm), date: localDateKey(sm.firstTs), effectiveTokens: sm.effectiveTokens });
    }
  }

  const repoSessions = committed + uncommitted;

  return {
    /** Every session in the window (the funnel's first stage). */
    sessions,
    /** Sessions that could commit — see hasRepo(). The commit rate's denominator. */
    repoSessions,
    noRepo,
    tokensNoRepo,
    committed,
    tokensCommitted,
    uncommitted,
    tokensUncommitted,
    rate: repoSessions > 0 ? committed / repoSessions : 0,
    /** Committed sessions that also opened or linked a pull request, and how many PRs — the funnel's last stage. */
    prSessions,
    prCount,
    /** Uncommitted repo sessions with a PR (e.g. opened for an earlier session's commits) — outside the funnel. */
    prOnlySessions,
    topUncommitted: topUncommitted
      .sort((a, b) => b.effectiveTokens - a.effectiveTokens)
      .slice(0, limit),
  };
}

// ---------------------------------------------------------------------------
// buildRejections
// ---------------------------------------------------------------------------

export function buildRejections(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);
  let total = 0;
  let guardianDenials = 0;
  let userDeclines = 0;
  const perToolMap = new Map<string, { calls: number; rejections: number }>();

  for (const tc of d.toolCalls) {
    if (tc.ts < from) continue;
    const isRejected = outcomeOf(d.toolResults.get(tc.id)) === 'rejected';

    let entry = perToolMap.get(tc.name);
    if (!entry) {
      entry = { calls: 0, rejections: 0 };
      perToolMap.set(tc.name, entry);
    }
    entry.calls++;

    if (isRejected) {
      total++;
      entry.rejections++;
      // Codex's guardian decided (its deny is a GuardianReview call); everything else is a person declining a prompt.
      if (tc.name === GUARDIAN_DENY_TOOL) guardianDenials++;
      else userDeclines++;
    }
  }

  const perTool = [...perToolMap.entries()]
    .filter(([, v]) => v.rejections > 0)
    .map(([name, v]) => ({ name, calls: v.calls, rejections: v.rejections }))
    .sort((a, b) => b.rejections - a.rejections);

  return { total, guardianDenials, userDeclines, perTool };
}

// ---------------------------------------------------------------------------
// buildSubagentStats
// ---------------------------------------------------------------------------

/** Spawns in the window split into delegated work and guardian auto-reviews. */
function spawnSplit(d: InsightsData, from: number, inWindow: Set<string>) {
  let delegationSpawns = 0;
  let reviews = 0;
  const delegating = new Set<string>();
  const reviewed = new Set<string>();
  for (const t of d.taskSpawns) {
    if (t.ts < from) continue;
    if (t.subagentType === GUARDIAN_REVIEW_TYPE) {
      reviews++;
      if (inWindow.has(t.sessionId)) reviewed.add(t.sessionId);
    } else {
      delegationSpawns++;
      if (inWindow.has(t.sessionId)) delegating.add(t.sessionId);
    }
  }
  let denials = 0;
  for (const tc of d.toolCalls) {
    if (tc.ts < from || tc.name !== GUARDIAN_DENY_TOOL) continue;
    if (outcomeOf(d.toolResults.get(tc.id)) === 'rejected') denials++;
  }
  return { delegationSpawns, reviews, denials, delegating, reviewed };
}

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
  const sessions = sessionsInWindow(d, from);
  let sessionsWithSpawns = 0;
  let codexSessions = 0;
  for (const sm of sessions) {
    if (sm.subagentSpawns > 0) sessionsWithSpawns++;
    if (sm.source === 'codex') codexSessions++;
  }
  const split = spawnSplit(d, from, new Set(sessions.map((s) => s.sessionId)));

  return {
    spawns,
    byType,
    byModel,
    avgPerSession: sessionsWithSpawns > 0 ? spawns / sessionsWithSpawns : 0,
    /** Any spawn, guardian reviews included (kept for the AI payload). */
    delegationRate: sessions.length > 0 ? sessionsWithSpawns / sessions.length : 0,
    /** Delegated work: Claude Task/Agent subagents and Codex's non-guardian subagents. */
    delegation: {
      spawns: split.delegationSpawns,
      sessions: split.delegating.size,
      rate: sessions.length > 0 ? split.delegating.size / sessions.length : null,
      avgPerSession: split.delegating.size > 0 ? split.delegationSpawns / split.delegating.size : 0,
    },
    /** Codex guardian auto-reviews: one per verdict; rate over Codex threads only. */
    autoReview: {
      reviews: split.reviews,
      denials: split.denials,
      sessions: split.reviewed.size,
      rate: codexSessions > 0 ? split.reviewed.size / codexSessions : null,
      avgPerSession: split.reviewed.size > 0 ? split.reviews / split.reviewed.size : 0,
    },
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

/** Case- and separator-insensitive form of a path, for prefix tests. */
function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/** Every known working directory (cwd, decoded project paths); pass UNSCOPED data — a Codex scratch-folder thread is labelled by the repo a Claude session ran in. */
export function knownProjectRoots(d: InsightsData): string[] {
  const roots = new Set<string>();
  for (const sm of d.sessionsMeta.values()) {
    if (sm.cwd) roots.add(sm.cwd);
    if (sm.projectPath) roots.add(sm.projectPath);
  }
  return [...roots];
}

interface RootEntry {
  norm: string;
  name: string;
  /** Holds several known projects side by side (e.g. `E:\dev-projects`, a home folder). */
  container: boolean;
}

/** Index the roots; a root with two or more known roots directly inside it is a container. */
function indexRoots(paths: string[]): RootEntry[] {
  const norms = [...new Set(paths.map(normPath))].filter(Boolean);
  const children = new Map<string, number>();
  for (const n of norms) {
    const parent = n.slice(0, n.lastIndexOf('/'));
    if (parent) children.set(parent, (children.get(parent) ?? 0) + 1);
  }
  const names = new Map(paths.map((p) => [normPath(p), lastSegment(p)]));
  return norms
    .map((norm) => ({ norm, name: names.get(norm) ?? '', container: (children.get(norm) ?? 0) >= 2 }))
    .filter((r) => r.name);
}

/** The session's own folder if the file is in it, else the deepest known root containing it, else '' — inside a container folder, the label is the folder right below it. */
function churnProject(filePath: string, projectPath: string, roots: RootEntry[]): string {
  const wt = worktreeRepo(filePath);
  if (wt) return wt;
  const f = normPath(filePath);
  const own = normPath(projectPath);
  const inside = (root: string) => f.startsWith(root + '/');
  let anchor: RootEntry | null = null;
  if (own && inside(own)) {
    anchor = roots.find((r) => r.norm === own) ?? { norm: own, name: lastSegment(projectPath), container: false };
  } else {
    for (const r of roots) if (inside(r.norm) && (!anchor || r.norm.length > anchor.norm.length)) anchor = r;
  }
  if (!anchor) return '';
  if (anchor.container) {
    const rest = filePath.replace(/\\/g, '/').slice(anchor.norm.length + 1).split('/');
    if (rest.length > 1 && rest[0]) return rest[0];
  }
  return anchor.name;
}

export function buildFileChurn(d: InsightsData, days: number, now = Date.now(), limit = 25, roots: string[] = []) {
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
  const rootIndex = indexRoots([...roots, ...knownProjectRoots(d)]);
  const files: FileChurnEntry[] = [...map.values()]
    .sort((a, b) => b.edits - a.edits)
    .slice(0, limit)
    .map((v) => ({
      path: v.path,
      name: lastSegment(v.path) || v.path,
      edits: v.edits,
      projectName: churnProject(v.path, v.projectPath, rootIndex),
      lastTs: v.lastTs,
    }));
  const totalEdits = [...map.values()].reduce((s, v) => s + v.edits, 0);
  return { totalEdits, uniqueFiles: map.size, files };
}

// ---------------------------------------------------------------------------
// buildTurnLatency — how long a turn takes, and how long until the first token
// ---------------------------------------------------------------------------

/** Histogram bucket upper bounds (exclusive); the last bucket is open-ended (null). */
export const LATENCY_BUCKETS: { label: string; upToMs: number | null }[] = [
  { label: '<10s', upToMs: 10_000 },
  { label: '10–30s', upToMs: 30_000 },
  { label: '30s–1m', upToMs: 60_000 },
  { label: '1–2m', upToMs: 120_000 },
  { label: '2–5m', upToMs: 300_000 },
  { label: '5–10m', upToMs: 600_000 },
  { label: '10–30m', upToMs: 1_800_000 },
  { label: '30m+', upToMs: null },
];

export interface LatencyStats {
  turns: number;
  medianMs: number | null;
  p90Ms: number | null;
  /** Null when no turn in the set recorded a time to first token. */
  medianTtftMs: number | null;
  p90TtftMs: number | null;
  /** Sum of turn durations — active time, not wall clock. */
  activeMs: number;
}

function latencyStats(durations: number[], ttfts: number[]): LatencyStats {
  const d = [...durations].sort((a, b) => a - b);
  const t = [...ttfts].sort((a, b) => a - b);
  return {
    turns: d.length,
    medianMs: percentile(d, 0.5),
    p90Ms: percentile(d, 0.9),
    medianTtftMs: percentile(t, 0.5),
    p90TtftMs: percentile(t, 0.9),
    activeMs: d.reduce((s, x) => s + x, 0),
  };
}

function bucketIndex(ms: number): number {
  const i = LATENCY_BUCKETS.findIndex((b) => b.upToMs !== null && ms < b.upToMs);
  return i === -1 ? LATENCY_BUCKETS.length - 1 : i;
}

/** Claude turns are derived (prompt → last reply, capped at 6h); Codex turns are task_complete's own duration. Histogram keeps platforms apart so Both can stack, not blend. */
export function buildTurnLatency(d: InsightsData, days: number, now = Date.now()) {
  const from = cutoff(days, now);
  const all = { dur: [] as number[], ttft: [] as number[] };
  const per: Record<InsightPlatform, { dur: number[]; ttft: number[] }> = {
    claude: { dur: [], ttft: [] },
    codex: { dur: [], ttft: [] },
  };
  const histogram = LATENCY_BUCKETS.map((b) => ({ label: b.label, upToMs: b.upToMs, claude: 0, codex: 0, total: 0 }));

  for (const r of d.turns) {
    if (r.ts < from || !(r.durationMs >= 0)) continue;
    const p = platformOf(r.source);
    all.dur.push(r.durationMs);
    per[p].dur.push(r.durationMs);
    if (r.ttftMs !== null && r.ttftMs >= 0) {
      all.ttft.push(r.ttftMs);
      per[p].ttft.push(r.ttftMs);
    }
    const h = histogram[bucketIndex(r.durationMs)];
    h[p]++;
    h.total++;
  }

  return {
    ...latencyStats(all.dur, all.ttft),
    histogram,
    byPlatform: {
      claude: per.claude.dur.length ? latencyStats(per.claude.dur, per.claude.ttft) : null,
      codex: per.codex.dur.length ? latencyStats(per.codex.dur, per.codex.ttft) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// buildInsightsSummary — the KPI row, per platform
// ---------------------------------------------------------------------------

export interface InsightKpis {
  totalCalls: number;
  /** Failed calls, rejections excluded. */
  failures: number;
  failureRate: number | null;
  rejections: number;
  rejectionRate: number | null;
  /** Non-sidechain sessions active in the window. */
  sessions: number;
  repoSessions: number;
  committed: number;
  /** committed / repoSessions; null when no session could commit. */
  commitRate: number | null;
  delegatingSessions: number;
  delegationSpawns: number;
  /** Sessions that delegated work to a subagent / all sessions; null with no sessions. */
  delegationRate: number | null;
  codexSessions: number;
  reviews: number;
  denials: number;
  reviewedSessions: number;
  /** Codex threads with a guardian review / Codex threads; null with no Codex thread. */
  autoReviewRate: number | null;
}

export function buildKpis(d: InsightsData, days: number, now = Date.now()): InsightKpis {
  const from = cutoff(days, now);
  let totalCalls = 0;
  let failures = 0;
  let rejections = 0;
  for (const tc of d.toolCalls) {
    if (tc.ts < from) continue;
    totalCalls++;
    const o = outcomeOf(d.toolResults.get(tc.id));
    if (o === 'failed') failures++;
    else if (o === 'rejected') rejections++;
  }

  const sessions = sessionsInWindow(d, from);
  let repoSessions = 0;
  let committed = 0;
  let codexSessions = 0;
  for (const sm of sessions) {
    if (sm.source === 'codex') codexSessions++;
    if (!hasRepo(sm)) continue;
    repoSessions++;
    if (sm.committed) committed++;
  }
  const split = spawnSplit(d, from, new Set(sessions.map((s) => s.sessionId)));

  return {
    totalCalls,
    failures,
    failureRate: totalCalls > 0 ? failures / totalCalls : null,
    rejections,
    rejectionRate: totalCalls > 0 ? rejections / totalCalls : null,
    sessions: sessions.length,
    repoSessions,
    committed,
    commitRate: repoSessions > 0 ? committed / repoSessions : null,
    delegatingSessions: split.delegating.size,
    delegationSpawns: split.delegationSpawns,
    delegationRate: sessions.length > 0 ? split.delegating.size / sessions.length : null,
    codexSessions,
    reviews: split.reviews,
    denials: split.denials,
    reviewedSessions: split.reviewed.size,
    autoReviewRate: codexSessions > 0 ? split.reviewed.size / codexSessions : null,
  };
}

/** Plus the same figures per platform for a Both view; a platform with no call and no session in the window is null. */
export function buildInsightsSummary(d: InsightsData, days: number, now = Date.now()) {
  const empty = (k: InsightKpis) => k.totalCalls === 0 && k.sessions === 0;
  const claude = buildKpis(scopeInsights(d, 'claude'), days, now);
  const codex = buildKpis(scopeInsights(d, 'codex'), days, now);
  return {
    ...buildKpis(d, days, now),
    byPlatform: {
      claude: empty(claude) ? null : claude,
      codex: empty(codex) ? null : codex,
    },
  };
}
