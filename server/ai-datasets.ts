/**
 * ai-datasets.ts — the retrieval layer behind AI Insights.
 *
 * Every surface the dashboard tracks is registered here as a *dataset*: a
 * description the model always sees (the catalog), a lexical trigger that routes
 * a question to it, and a loader that projects the backing builder into a
 * model-safe shape.
 *
 * THIS FILE IS THE PRIVACY BOUNDARY. The hard rule, no exceptions:
 *
 *   NEVER spread a builder's return — project an explicit allowlist of fields.
 *
 * `scrubForModel` (ai-context.ts) is a key-name blocklist and cannot save us:
 * `WorkflowRun.logsTail` is raw orchestration stdout, and `summary` /
 * `phases[].detail` / `resultStats` are free text from a generated script — any
 * of them can carry an absolute path *inside a string value*, which no key-name
 * filter can strip. The projections below are the real boundary; the scrub is
 * defense-in-depth.
 */

import { getEvents, eventsFingerprint } from './cache.ts';
import { getInsights, insightsFingerprint } from './insights-scan.ts';
import { memoBuilder } from './builder-cache.ts';
import { buildHourlyHeatmap, filterSource, type SourceFilter } from './aggregate.ts';
import {
  buildErrors, buildRetries, buildLanguages, buildBranches, buildMcp,
  buildComplexity, buildYield, buildRejections, buildSubagentStats, buildFileChurn, scopeInsights,
} from './insights.ts';
import { buildContributors, type ContributorsData } from './contributors.ts';
import { hasCodexEvents } from './sources.ts';
import { getCommandUsage } from './history.ts';
import { getWorkspaceTasks, getInventory, workspaceScope, type InventoryData, type WorkspaceTasksData } from './workspace.ts';
import { getWorkflowStats, type WorkflowRunSummary } from './workflows.ts';
import { fetchLiveUsage } from './scan.ts';
import { fetchCodexUsage, type CodexLiveData } from './codex-live.ts';

/** Which provider(s) a chat scope covers: Claude surfaces, Codex, or both (`all`). */
export type AiPlatform = 'claude' | 'codex' | 'both';

export function platformOf(source: SourceFilter): AiPlatform {
  return source === 'codex' ? 'codex' : source === 'all' ? 'both' : 'claude';
}

/** A chat scope of `all` without any Codex data is a Claude-only install: scope and word it as Claude, never as both. */
export function aiSource(source: SourceFilter, codexAvailable: boolean): SourceFilter {
  return source === 'all' && !codexAvailable ? 'claude' : source;
}

/** `/api/sources`' codex.available. Without it, codexDir() may be Docker's fallback mount of ~/.claude. */
async function codexHasData(): Promise<boolean> {
  return hasCodexEvents((await getEvents()).events);
}

// Shared by ai-context.ts's `limits` block; each provider's quota is its own percentage of its own plan — never summed.

export type LiveRead<T> = { usage: T } | { unavailable: string };

/** Anthropic's live usage (Claude.ai plan). Never throws. */
export async function readClaudeLive(): Promise<LiveRead<any>> {
  try {
    const live: any = await fetchLiveUsage();
    if (!live || live.error) return { unavailable: String(live?.error ?? 'live usage API unreachable') };
    return { usage: live };
  } catch (e) {
    return { unavailable: e instanceof Error ? e.message : String(e) };
  }
}

/** OpenAI's live Codex windows (ChatGPT plan), or the newest local snapshot. Never throws. */
export async function readCodexLive(): Promise<LiveRead<CodexLiveData>> {
  try {
    const live = await fetchCodexUsage();
    if (live.error) return { unavailable: live.error };
    return { usage: live };
  } catch (e) {
    return { unavailable: e instanceof Error ? e.message : String(e) };
  }
}

/** The Codex windows in the same field names the Claude block uses (a weekly window = sevenDay). */
export function codexLimitFields(live: CodexLiveData) {
  return {
    provider: 'OpenAI — ChatGPT plan (Codex)',
    planType: live.planType,
    fiveHourPct: live.fiveHour?.usedPct ?? null,
    fiveHourResetsAt: live.fiveHour?.resetsAt ?? null,
    sevenDayPct: live.weekly?.usedPct ?? null,
    sevenDayResetsAt: live.weekly?.resetsAt ?? null,
    limitReached: live.limitReached,
    credits: live.credits
      ? { hasCredits: live.credits.hasCredits, unlimited: live.credits.unlimited, overageLimitReached: live.credits.overageLimitReached }
      : null,
    origin: live.origin === 'live' ? 'live from OpenAI' : `snapshot from the newest local rollout (${live.snapshotAt ?? 'age unknown'})`,
  };
}

export type DatasetId =
  | 'workflows' | 'errors' | 'retries' | 'branches' | 'churn' | 'sessions' | 'commands'
  | 'subagents' | 'mcp' | 'rejections' | 'languages' | 'yield' | 'contributors'
  | 'heatmap' | 'limits' | 'tasks' | 'plugins';

export interface DatasetQuery {
  days: number;
  source: SourceFilter;
  limit: number;
  /** True when the chat is pointed at a third-party provider (OpenAI/Gemini). */
  redact: boolean;
}

/** Machine-readable provenance carried by EVERY list handed to the model. */
export interface Slice<T> {
  sortedBy: string;
  shown: number;
  total: number;
  truncated: boolean;
  items: T[];
  other?: Record<string, number>;
}

/**
 * Wrap THEN slice — never slice before wrapping, or `total` reports the clipped
 * length and `truncated` reads false on a list that *was* truncated, which is the
 * exact hallucination this provenance exists to prevent.
 */
export function topN<T>(
  rows: T[],
  n: number,
  sortedBy: string,
  rollup?: (rest: T[]) => Record<string, number>,
): Slice<T> {
  const items = rows.slice(0, n);
  const rest = rows.slice(n);
  const s: Slice<T> = { sortedBy, shown: items.length, total: rows.length, truncated: rest.length > 0, items };
  // A partial list must still RECONCILE against the total, or the model "notices"
  // that the top 8 sum to less than the account total and reports a phantom bug.
  if (rest.length > 0 && rollup) s.other = { count: rest.length, ...rollup(rest) };
  return s;
}

export interface DatasetDef {
  id: DatasetId;
  /** Goes VERBATIM into the catalog the model always sees (the Claude wording). */
  describes: string;
  /** Replacement catalog wording when the chat is scoped to Codex / to both platforms. */
  describesFor?: Partial<Record<Exclude<AiPlatform, 'claude'>, string>>;
  /** Set on a Claude-only dataset: why it is unavailable while the chat is scoped to Codex. */
  claudeOnly?: string;
  /** Lexical route — free, deterministic, works on every backend. */
  trigger: RegExp;
  load: (q: DatasetQuery) => Promise<unknown>;
}

const WORKFLOWS_CLAUDE_ONLY =
  'Workflows are runs of Claude Code\'s Workflow orchestration tool — Codex has no equivalent, so there is nothing to show while the dashboard is on Codex.';

const RETRIES_CLAUDE_ONLY =
  'Codex patches never retry — each one applies, fails or is declined, and the next is a new change — so there is no one-shot rate while the dashboard is on Codex.';
const COMMANDS_CLAUDE_ONLY =
  'Codex records neither slash commands nor skill runs (a skill load is only a file read inside a shell command), ' +
  'so command and skill usage is tracked for Claude Code only.';

const SOFT_TIMEOUT_MS = 1500;
const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (rate: number) => Math.round(rate * 1000) / 10;

/**
 * A chat turn must never inherit a slow sidecar. `getWorkflows()` streams
 * journal.jsonl and parses up to 24 agent transcripts while a run is live.
 */
function soft<T>(fn: () => Promise<T>, ms = SOFT_TIMEOUT_MS): Promise<T | null> {
  return Promise.race([
    fn().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** The window a block actually covers, stated in the block itself. */
function win(days: number, now: number) {
  return {
    days,
    from: new Date(now - days * 86_400_000).toISOString(),
    to: new Date(now).toISOString(),
  };
}

const REDACTED = {
  redacted: 'Branch and file names are not sent to third-party model providers. Ask again with the local Claude backend to see them.',
};

// ── Scoped builder access ────────────────────────────────────────────────────
// Memo keys deliberately reuse index.ts's BARE names so the AI path hits the
// dashboard's already-warm entries instead of re-running O(events) aggregation
// the dashboard just ran. Two rules keep the keys interchangeable — break either
// and the dashboard's own route cache is silently poisoned:
//   - event builders are called with now = computedAt from getEvents();
//   - insights builders are called with now = computedAt from getInsights().
// The five `limit: Infinity` variants get their own ':full' keys because their
// output differs from what the routes cache under the bare name.

async function scopedInsights(source: SourceFilter) {
  const { insights, computedAt } = await getInsights();
  return { d: scopeInsights(insights, source), now: computedAt };
}

// ── Row projections (the allowlist) ──────────────────────────────────────────

export function rejectionsDetail(r: ReturnType<typeof buildRejections>, p: AiPlatform, limit: number) {
  return {
    total: r.total,
    ...(p === 'claude' ? {} : { userDeclines: r.userDeclines, guardianDenials: r.guardianDenials }),
    perTool: topN(r.perTool, limit, 'rejections desc'),
  };
}

export function contributorsDetail(c: ContributorsData, limit: number) {
  const projectWindow = (w: ContributorsData['day']) => ({
    totalEstCostUsd: round2(w.totalCost),
    requestCount: w.requestCount,
    sessionCount: w.sessionCount,
    behaviors: w.behaviors.map((b) => ({ key: b.key, headline: b.headline, pct: b.pct })),
    subagents: topN(w.subagents, limit, 'pct desc'),
    mcpServers: topN(w.mcpServers, limit, 'pct desc'),
    skills: topN(w.skills, limit, 'pct desc'),
    plugins: topN(w.plugins, limit, 'pct desc'),
  });
  return {
    weight: c.weight,
    weightNote:
      c.weight === 'effectiveTokens'
        ? 'Every pct is a share of EFFECTIVE TOKENS, not of cost (the Guardian auto-reviewer is priced at $0 but still spends the plan limit) — never quote a pct as a share of totalEstCostUsd.'
        : 'Every pct is a share of estimated cost.',
    day: projectWindow(c.day),
    week: projectWindow(c.week),
  };
}

function workflowSummaryRow(s: WorkflowRunSummary) {
  return {
    name: s.name,
    project: s.project,
    status: s.status,
    effectiveTokens: s.tokens,
    estCostUsd: round2(s.cost),
    costBasis: s.costBasis,
    subagents: s.agentCount,
    toolCalls: s.toolCalls,
    model: s.defaultModel,
    durationMin: Math.round(s.durationMs / 60_000),
    startedAt: new Date(s.startedAt).toISOString().slice(0, 10),
  };
}

// ── The registry ─────────────────────────────────────────────────────────────

export const DATASETS: DatasetDef[] = [
  {
    id: 'workflows',
    describes:
      'Workflow orchestration runs (the multi-agent Workflow tool: one generated script fanning out N subagents ' +
      'across phases). Per-run name, project, status, subagent count, effective tokens, ESTIMATED cost and duration, ' +
      'plus ALL-TIME top runs by cost. A workflow is NOT a project, a session, or a subagent.',
    describesFor: {
      both:
        'Claude Code workflow orchestration runs (the multi-agent Workflow tool) — CLAUDE ONLY, Codex has no workflows. Per-run name, project, ' +
        'status, subagent count, effective tokens, ESTIMATED cost and duration, plus ALL-TIME top runs by cost.',
    },
    claudeOnly: WORKFLOWS_CLAUDE_ONLY,
    trigger: /\bwork[\s-]?flows?\b|\borchestrat|\bwf_|\bagent[\s-]?swarms?\b|\bfan[\s-]?out\b|\bmulti[\s-]?agent\b/i,
    async load({ limit, source }) {
      if (platformOf(source) === 'codex') return { unavailable: WORKFLOWS_CLAUDE_ONLY };
      // Deliberately NOT getWorkflows(): it re-parses every final journal and takes
      // ~8s on a real history, which a chat turn must never wait on. getWorkflowStats()
      // peeks the same journals (memoized by path+mtime) in well under a second and
      // covers ALL of them, not just the 90-day / 200-run window the list is capped to.
      const stats = await soft(getWorkflowStats, 4000);
      if (!stats) return { unavailable: 'workflow journals could not be read in time' };
      return {
        window: 'all-time',
        source: 'code-only',
        scopeNote:
          'IGNORES the chat scope: these cover EVERY workflow journal on disk, Claude Code surface only (never Cowork). ' +
          'Use `topRunsByCost` for "most expensive ever" and `recentRuns` for "what did I run lately".',
        caveats: [
          'estCostUsd is an ESTIMATED equivalent-API cost, not a bill.',
          'costBasis "blended-run" prices a whole run at one blended rate from `model` (often literally "inherit", which falls back to a generic rate), so the ranking between close runs can be off. "per-agent" is priced per subagent model and is more reliable.',
          'Currently-running workflows are not included — only finished runs that wrote a journal.',
          'Workflow tokens are ALREADY inside the account totals — never add them on top.',
        ],
        allTime: {
          totalRuns: stats.totalRuns,
          completed: stats.completed,
          failed: stats.failed,
          successRatePct: pct(stats.successRate),
          totalEffectiveTokens: stats.totalTokens,
          estCostUsd: round2(stats.estCostUsd),
          totalSubagents: stats.totalAgents,
          topModel: stats.topModel,
        },
        topRunsByCost: topN(stats.topRunsByCost.map(workflowSummaryRow), limit, 'estCostUsd desc'),
        recentRuns: topN(stats.recentRuns.map(workflowSummaryRow), limit, 'startedAt desc'),
      };
    },
  },
  {
    id: 'errors',
    describes:
      'Tool-call failures: overall error rate, error categories, worst tools by call volume, and a DAY-BY-DAY error-rate trend.',
    trigger: /\berrors?\b|\bfail(s|ed|ing|ure|ures)?\b|\berror[\s-]?rate\b|\bbroke\b|\bflaky\b/i,
    async load({ days, source, limit }) {
      const { d, now } = await scopedInsights(source);
      const e = memoBuilder('errors:full', [days, source], insightsFingerprint(), () =>
        buildErrors(d, days, now, Number.POSITIVE_INFINITY),
      );
      return {
        window: win(days, Date.now()),
        source,
        totalCalls: e.totalCalls,
        errors: e.errors,
        errorRatePct: pct(e.errorRate),
        categories: e.categories,
        worstTools: topN(e.perTool, limit, 'calls desc'),
        dailyTrend: e.trend, // [{date, calls, errors}] — the only place a trend exists
      };
    },
  },
  {
    id: 'retries',
    describes: 'Edit-retry analysis: one-shot success rate on Edit/Write, how many edits were retried, and the tokens/cost wasted on retries.',
    describesFor: {
      both: 'Edit-retry analysis for CLAUDE edits only (Codex patches never retry): one-shot success rate on Edit/Write, how many edits were retried, and the tokens/cost wasted on retries.',
    },
    claudeOnly: RETRIES_CLAUDE_ONLY,
    trigger: /\bretr(y|ies|ied)\b|\bone[\s-]?shot\b|\bwasted?\b|\bre[\s-]?edit/i,
    async load({ days, source }) {
      if (platformOf(source) === 'codex') return { unavailable: RETRIES_CLAUDE_ONLY };
      const { d, now } = await scopedInsights(source);
      const r = memoBuilder('retries', [days, source], insightsFingerprint(), () => buildRetries(d, days, now));
      return {
        window: win(days, Date.now()),
        source,
        totalEdits: r.totalEdits,
        retried: r.retried,
        oneShotRatePct: r.oneShotRate === null ? null : pct(r.oneShotRate),
        wastedTokens: r.wastedTokens,
        wastedEstCostUsd: round2(r.wastedCost),
      };
    },
  },
  {
    id: 'branches',
    describes: 'Per-git-branch usage: which branch (and repo) burned the most effective tokens and estimated cost, and over how many sessions.',
    trigger: /\bbranch(es)?\b|\bgit\b|\brepo(sitor(y|ies))?\b|\bpr\b/i,
    async load({ days, source, limit, redact }) {
      if (redact) return REDACTED;
      const { d, now } = await scopedInsights(source);
      const rows = memoBuilder('branches:full', [days, source], insightsFingerprint(), () =>
        buildBranches(d, days, now, Number.POSITIVE_INFINITY),
      );
      return {
        window: win(days, Date.now()),
        source,
        branches: topN(
          rows.map((b) => ({
            branch: b.branch,
            repo: b.repo,
            effectiveTokens: b.effectiveTokens,
            estCostUsd: round2(b.cost),
            sessions: b.sessions,
          })),
          limit,
          'effectiveTokens desc',
          (rest) => ({
            effectiveTokens: rest.reduce((s, b) => s + b.effectiveTokens, 0),
            estCostUsd: round2(rest.reduce((s, b) => s + b.estCostUsd, 0)),
          }),
        ),
      };
    },
  },
  {
    id: 'churn',
    describes: 'File churn: which files were edited most often (the ones being rewritten over and over), and the total edit count.',
    trigger: /\bchurn\b|\bfiles?\b|\bmost[\s-]?edited\b|\brewrit/i,
    async load({ days, source, limit, redact }) {
      if (redact) return REDACTED;
      const { d, now } = await scopedInsights(source);
      const c = memoBuilder('churn:full', [days, source], insightsFingerprint(), () =>
        buildFileChurn(d, days, now, Number.POSITIVE_INFINITY),
      );
      return {
        window: win(days, Date.now()),
        source,
        totalEdits: c.totalEdits,
        uniqueFiles: c.uniqueFiles,
        files: topN(
          c.files.map((f) => ({ file: f.name, project: f.projectName, edits: f.edits })),
          limit,
          'edits desc',
          (rest) => ({ edits: rest.reduce((s, f) => s + f.edits, 0) }),
        ),
      };
    },
  },
  {
    id: 'sessions',
    describes:
      'Per-session complexity: individual CLI conversations with their turn count, tool calls, subagents spawned, effective tokens and duration. ' +
      'Use this for "which session was heaviest/longest/most expensive". A session is NOT a project and NOT a workflow.',
    describesFor: {
      codex:
        'Per-thread complexity: individual Codex threads with their turn count, tool calls, Guardian auto-reviews (in `subagents`), effective tokens and duration. ' +
        'Use this for "which thread was heaviest/longest/most expensive". A thread is NOT a project.',
      both:
        'Per-session complexity: individual Claude Code sessions and Codex threads with their turn count, tool calls, subagents (Codex: Guardian auto-reviews), ' +
        'effective tokens and duration. Use this for "which session was heaviest/longest/most expensive". A session is NOT a project and NOT a workflow.',
    },
    trigger: /\bsessions?\b|\bthreads?\b|\bconversations?\b|\bchats?\b|\bcomplexit|\bheaviest\b|\blongest\b/i,
    async load({ days, source, limit }) {
      const { d, now } = await scopedInsights(source);
      const rows = memoBuilder('complexity:full', [days, source], insightsFingerprint(), () =>
        buildComplexity(d, days, now, Number.POSITIVE_INFINITY),
      );
      return {
        window: win(days, Date.now()),
        source,
        totalSessions: rows.length,
        // sessionId is deliberately dropped — it is an identifier, not a metric.
        heaviestSessions: topN(
          rows.map((s) => ({
            project: s.project,
            date: s.date,
            turns: s.turns,
            toolCalls: s.toolCalls,
            subagents: s.subagents,
            effectiveTokens: s.effectiveTokens,
            durationMin: s.durationMin,
          })),
          limit,
          'effectiveTokens desc',
          (rest) => ({ effectiveTokens: rest.reduce((s, r) => s + r.effectiveTokens, 0) }),
        ),
      };
    },
  },
  {
    id: 'commands',
    describes: 'Slash-command and skill usage: which /commands and skills were invoked and how often.',
    describesFor: {
      both: 'Slash-command and skill usage — CLAUDE CODE ONLY (Codex records neither): which /commands and skills were invoked and how often.',
    },
    claudeOnly: COMMANDS_CLAUDE_ONLY,
    trigger: /\bslash\b|\bcommands?\b|\bskills?\b|\/\w+/i,
    async load({ days, source, limit }) {
      if (platformOf(source) === 'codex') return { unavailable: COMMANDS_CLAUDE_ONLY };
      const c = await soft(() => getCommandUsage(days, undefined, source));
      if (!c) return { unavailable: 'command history could not be read in time' };
      return {
        window: win(days, Date.now()),
        source,
        scopeNote:
          'Slash commands come from Claude Code\'s history file (Claude Code only); skills count the sessions that ran them on this scope.',
        totalCommands: c.totalCommands,
        uniqueCommands: c.uniqueCommands,
        commands: topN(c.commands, limit, 'count desc', (rest) => ({ count: rest.reduce((s, x) => s + x.count, 0) })),
      };
    },
  },
  {
    id: 'subagents',
    describes: 'Subagent delegation: how many Task subagents were spawned, by agent type and by model, and the share of sessions that delegate.',
    describesFor: {
      codex:
        'Guardian auto-reviews and subagents in Codex: how many planned actions the Guardian auto-reviewer checked (and denied), in how many threads, ' +
        'plus any delegated subagent threads. A Guardian review is a safety check, NOT delegated work.',
      both:
        'Subagents: Claude Task subagents (delegated work) and Codex Guardian auto-reviews (safety checks of planned actions, NOT delegated work), ' +
        'by type and model, with separate delegation and auto-review rates.',
    },
    trigger: /\bsub[\s-]?agents?\b|\bdelegat|\btask tool\b|\bspawn|\bguardian\b|\bauto[\s-]?review/i,
    async load({ days, source }) {
      const { d, now } = await scopedInsights(source);
      const s = memoBuilder('subagents', [days, source], insightsFingerprint(), () => buildSubagentStats(d, days, now));
      return {
        window: win(days, Date.now()),
        source,
        spawns: s.spawns,
        byType: s.byType,
        byModel: s.byModel,
        avgPerSession: s.avgPerSession,
        // Delegated work only (the Insights panel's figure) — Codex Guardian reviews are counted apart.
        delegationRatePct: s.delegation.rate === null ? null : pct(s.delegation.rate),
        delegatedSpawns: s.delegation.spawns,
        ...(platformOf(source) === 'claude'
          ? {}
          : {
              guardianReviews: {
                reviews: s.autoReview.reviews,
                denials: s.autoReview.denials,
                threads: s.autoReview.sessions,
                ratePctOfCodexThreads: s.autoReview.rate === null ? null : pct(s.autoReview.rate),
              },
            }),
      };
    },
  },
  {
    id: 'mcp',
    describes: 'MCP vs built-in tool split: how many calls went to MCP servers vs built-in tools, and per-MCP-server call and error counts.',
    trigger: /\bmcp\b|\bservers?\b|\bbuilt[\s-]?in\b|\bintegrations?\b/i,
    async load({ days, source, limit }) {
      const { d, now } = await scopedInsights(source);
      const m = memoBuilder('mcp', [days, source], insightsFingerprint(), () => buildMcp(d, days, now));
      return {
        window: win(days, Date.now()),
        source,
        builtinCalls: m.builtinCalls,
        mcpCalls: m.mcpCalls,
        perServer: topN(m.perServer, limit, 'calls desc'),
      };
    },
  },
  {
    id: 'rejections',
    describes: 'Permission rejections: how many tool calls the user denied, broken down per tool.',
    describesFor: {
      codex:
        'Rejections in Codex: tool calls the user declined (userDeclines) and planned actions the Guardian auto-reviewer denied ' +
        '(guardianDenials), per tool. A Guardian denial is NOT a user rejection.',
      both:
        'Rejections: tool calls the user declined (Claude permission prompts, Codex approvals — userDeclines) and actions the Codex ' +
        'Guardian auto-reviewer denied (guardianDenials), per tool. A Guardian denial is NOT a user rejection.',
    },
    trigger: /\breject|\bdenied?\b|\bpermissions?\b|\bblocked\b/i,
    async load({ days, source, limit }) {
      const { d, now } = await scopedInsights(source);
      const r = memoBuilder('rejections', [days, source], insightsFingerprint(), () => buildRejections(d, days, now));
      return { window: win(days, Date.now()), source, ...rejectionsDetail(r, platformOf(source), limit) };
    },
  },
  {
    id: 'languages',
    describes: 'Language / file-type breakdown: which languages were edited and read most.',
    trigger: /\blanguages?\b|\bfile[\s-]?types?\b|\btypescript\b|\bpython\b|\bwhat.*(do i|am i) (writ|cod)/i,
    async load({ days, source, limit }) {
      const { d, now } = await scopedInsights(source);
      const langs = memoBuilder('languages', [days, source], insightsFingerprint(), () => buildLanguages(d, days, now));
      return {
        window: win(days, Date.now()),
        source,
        languages: topN(langs, limit, 'edits desc', (rest) => ({ edits: rest.reduce((s, l) => s + l.edits, 0) })),
      };
    },
  },
  {
    id: 'yield',
    describes: 'Committed-vs-uncommitted yield: what share of sessions ended in a git commit, and the tokens spent on sessions that never landed.',
    trigger: /\byield\b|\bcommit(s|ted|ting)?\b|\buncommitted\b|\bland(ed)?\b|\bshipped?\b/i,
    async load({ days, source, limit }) {
      const { d, now } = await scopedInsights(source);
      const y = memoBuilder('yield:full', [days, source], insightsFingerprint(), () =>
        buildYield(d, days, now, Number.POSITIVE_INFINITY),
      );
      return {
        window: win(days, Date.now()),
        source,
        committedSessions: y.committed,
        uncommittedSessions: y.uncommitted,
        commitRatePct: pct(y.rate),
        tokensCommitted: y.tokensCommitted,
        tokensUncommitted: y.tokensUncommitted,
        topUncommitted: topN(y.topUncommitted, limit, 'effectiveTokens desc'),
      };
    },
  },
  {
    id: 'contributors',
    describes:
      'What is driving your rate-limit usage: a cost-weighted Day and Week breakdown by behavior, subagent, MCP server, skill and plugin ' +
      '(the same panel the Claude CLI shows).',
    describesFor: {
      codex:
        'What is driving your Codex rate-limit usage: an effective-token-weighted Day and Week breakdown (shares of effective tokens, ' +
        'not of cost) by behavior and subagent, Guardian auto-reviews included.',
      both:
        'What is driving your rate-limit usage on this scope: a Day and Week breakdown by behavior, subagent, MCP server, skill and plugin — ' +
        'shares of estimated cost, or of effective tokens when the scope holds only Codex data (see `weight`). Claude and Codex limits are separate quotas.',
    },
    trigger: /\bcontribut|\bwhat.?s driving\b|\bdrives?\b|\bwhat.*(using|eating|burning).*(limit|quota)\b/i,
    async load({ source, limit }) {
      const { events, computedAt } = await getEvents();
      const c = memoBuilder('contributors', [source], eventsFingerprint(), () =>
        buildContributors(filterSource(events, source), computedAt),
      );
      return {
        window: 'native',
        source,
        scopeNote: 'IGNORES the chat window: `day` is the last 24h and `week` is the last 7 days, always.',
        ...contributorsDetail(c, limit),
      };
    },
  },
  {
    id: 'heatmap',
    describes: 'When you work: a 7×24 grid of effective tokens by day-of-week (Mon=0) and hour-of-day (local time).',
    trigger: /\bheat[\s-]?map\b|\bwhat time\b|\bhour(s|ly)?\b|\btime of day\b|\bwhen do i\b|\bpeak\b/i,
    async load({ days, source }) {
      const { events, computedAt } = await getEvents();
      const h = memoBuilder('heatmap', [days, source], eventsFingerprint(), () =>
        buildHourlyHeatmap(filterSource(events, source), computedAt, days),
      );
      return {
        window: win(days, computedAt),
        source,
        legend: 'grid[dayOfWeek][hour] = effective tokens. dayOfWeek 0=Mon..6=Sun, hour 0..23, local time.',
        grid: h.grid,
      };
    },
  },
  {
    id: 'limits',
    describes:
      "Anthropic's LIVE rate-limit quota for the account: the 5-hour and 7-day utilization percentages, when they reset, " +
      'and any extra-usage/overage credits. This is a percentage of a plan allowance — NOT dollars, and NOT the estimated costs elsewhere.',
    describesFor: {
      codex:
        "OpenAI's LIVE Codex rate-limit windows for the ChatGPT plan: the 5-hour and weekly used percentages, when they reset, " +
        'whether a limit is reached, and plan credits. A percentage of a plan allowance — NOT dollars.',
      both:
        "Each provider's LIVE rate-limit quota, one block per provider: Anthropic's Claude.ai 5-hour / 7-day utilization and OpenAI's Codex " +
        '5-hour / weekly windows, with reset times. Separate quotas — never add or average them; NOT dollars.',
    },
    trigger: /\blimits?\b|\bquota\b|\brate[\s-]?limit\b|\breset/i,
    async load({ source }) {
      const p = platformOf(source);
      if (p === 'claude') return claudeLimitsDetail(await timely(readClaudeLive));
      if (p === 'codex') return codexLimitsDetail(await timely(readCodexLive));
      const [claude, codex] = await Promise.all([timely(readClaudeLive), timely(readCodexLive)]);
      return {
        window: 'native',
        source: 'account',
        scopeNote: 'One block per provider. Each is that provider\'s own plan quota — never add or compare them as one number.',
        claude: claudeLimitsDetail(claude),
        codex: codexLimitsDetail(codex),
      };
    },
  },
  {
    id: 'tasks',
    describes: 'Tasks & plans backlog: task count by status, completion rate, blocked tasks, and saved plan files.',
    describesFor: {
      codex:
        'Codex plans: the PLAN.md files Codex planning turns saved, with title and age. Task tracking is a Claude Code feature — ' +
        'the task half is unavailable while the dashboard is on Codex.',
      both:
        'Tasks & plans backlog: Claude Code tasks by status, completion rate and blocked tasks (Claude only), and saved plan files from both platforms.',
    },
    trigger: /\btasks?\b|\bplans?\b|\bbacklog\b|\bblocked\b|\btodos?\b/i,
    async load({ source, limit }) {
      const scope = workspaceScope(source);
      const t = await soft<WorkspaceTasksData>(async () =>
        getWorkspaceTasks(scope, Date.now(), scope !== 'claude' && (await codexHasData())),
      );
      if (!t) return { unavailable: 'workspace tasks could not be read in time' };
      const plans = {
        totalPlans: t.plans.total,
        plans: topN(
          t.plans.items.map((p) => ({ title: p.title, ageDays: p.ageDays, ...(p.platform ? { platform: p.platform } : {}) })),
          limit,
          'ageDays asc',
        ),
      };
      if (scope === 'codex') {
        return {
          window: 'all-time',
          source,
          tasks: { unavailable: 'Task tracking is a Claude Code feature — Codex keeps no task list. Only its plans are shown.' },
          ...plans,
        };
      }
      return {
        window: 'all-time',
        source: scope === 'all' ? 'all' : 'claude',
        totalTasks: t.tasks.total,
        byStatus: t.tasks.byStatus,
        completionRatePct: pct(t.tasks.completionRate),
        blocked: t.tasks.items.filter((i) => i.blocked).map((i) => ({ subject: i.subject, status: i.status })),
        tasks: topN(t.tasks.items.map((i) => ({ subject: i.subject, status: i.status, blocked: i.blocked })), limit, 'insertion order'),
        ...plans,
      };
    },
  },
  {
    id: 'plugins',
    describes: 'Installed inventory: plugins, their marketplaces, configured MCP servers, and active hooks.',
    describesFor: {
      codex:
        'Codex inventory from config.toml: plugins (enabled or not), marketplaces, MCP servers, the notify hook, skills, and scheduled automations.',
      both: 'Installed inventory per platform: plugins, marketplaces, MCP servers, hooks, skills, and (Codex) scheduled automations.',
    },
    trigger: /\bplugins?\b|\bmarketplaces?\b|\binventory\b|\bhooks?\b|\binstalled\b|\bautomations?\b|\bscheduled\b/i,
    async load({ source }) {
      const scope = workspaceScope(source);
      const codexData = scope !== 'claude' && (await codexHasData());
      if (scope !== 'all') {
        const inv = await soft<InventoryData>(() => getInventory(scope, Date.now(), codexData));
        if (!inv) return { unavailable: 'inventory could not be read in time' };
        return { window: 'all-time', source: scope, ...inventoryDetail(inv) };
      }
      const [claude, codex] = await Promise.all([
        soft<InventoryData>(() => getInventory('claude')),
        soft<InventoryData>(() => getInventory('codex', Date.now(), codexData)),
      ]);
      const unavailable = { unavailable: 'inventory could not be read in time' };
      return {
        window: 'all-time',
        source: 'all',
        claude: claude ? inventoryDetail(claude) : unavailable,
        codex: codex ? inventoryDetail(codex) : unavailable,
      };
    },
  },
];

/** A live-limits read under the chat's soft timeout — a slow provider API degrades to `unavailable`. */
async function timely<T>(read: () => Promise<LiveRead<T>>): Promise<LiveRead<T>> {
  return (await soft(read)) ?? { unavailable: 'the live usage API did not answer in time' };
}

/** Names, versions and flags only — the allowlist for the `plugins` dataset. */
function inventoryDetail(inv: InventoryData) {
  return {
    plugins: inv.plugins.map((p) => ({
      name: p.name,
      marketplace: p.marketplace,
      ...(p.version ? { version: p.version } : {}),
      ...(p.enabled === undefined ? {} : { enabled: p.enabled }),
    })),
    enabledPlugins: inv.enabledPlugins,
    marketplaces: inv.marketplaces,
    mcpServers: inv.mcpServers.map((m) => ({ name: m.name, scope: m.scope })),
    hooks: inv.hooks,
    model: inv.model,
    effortLevel: inv.effortLevel,
    ...(inv.skills ? { skills: inv.skills.map((s) => (s.system ? `${s.name} (bundled)` : s.name)) } : {}),
    ...(inv.automations ? { automations: inv.automations.map((a) => ({ name: a.name, schedule: a.schedule, status: a.status })) } : {}),
  };
}

function claudeLimitsDetail(live: LiveRead<any>) {
  if (!('usage' in live)) return live;
  const u = live.usage;
  return {
    window: 'native',
    source: 'account',
    scopeNote: 'Live from Anthropic, covers the whole Claude account across all surfaces. IGNORES the chat scope.',
    fiveHourPct: u.five_hour?.utilization ?? null,
    fiveHourResetsAt: u.five_hour?.resets_at ?? null,
    sevenDayPct: u.seven_day?.utilization ?? null,
    sevenDayResetsAt: u.seven_day?.resets_at ?? null,
    sevenDayOpusPct: u.seven_day_opus?.utilization ?? null,
    extraUsageEnabled: u.extra_usage?.is_enabled ?? null,
    extraUsagePct: u.extra_usage?.utilization ?? null,
  };
}

function codexLimitsDetail(live: LiveRead<CodexLiveData>) {
  if (!('usage' in live)) return live;
  return {
    window: 'native',
    source: 'account',
    scopeNote: 'The ChatGPT plan\'s Codex windows (desktop, web and mobile Codex use all count). IGNORES the chat window.',
    ...codexLimitFields(live.usage),
  };
}

const BY_ID = new Map(DATASETS.map((d) => [d.id, d]));

/** The Claude-wording catalog (ids + descriptions). */
export const CATALOG: { id: DatasetId; describes: string }[] = DATASETS.map((d) => ({
  id: d.id,
  describes: d.describes,
}));

export interface CatalogEntry {
  id: DatasetId;
  describes: string;
  /** Present when the dataset cannot answer on this scope (a Claude-only dataset under Codex). */
  unavailable?: string;
}

/** Codex scope never describes Claude-only vocabulary; a Claude-only dataset is flagged unavailable instead of silently answering with Claude data. */
export function catalogFor(source: SourceFilter): CatalogEntry[] {
  const p = platformOf(source);
  return DATASETS.map((d) => {
    const describes = p === 'claude' ? d.describes : d.describesFor?.[p] ?? d.describes;
    return p === 'codex' && d.claudeOnly ? { id: d.id, describes, unavailable: d.claudeOnly } : { id: d.id, describes };
  });
}

export function datasetsDisabled(): boolean {
  return process.env.AI_DATASETS_DISABLED === '1';
}

/** Deterministic keyword routing — zero model calls, works on every backend. */
export function lexicalRoute(text: string, max = 3): DatasetId[] {
  const hits: DatasetId[] = [];
  for (const d of DATASETS) {
    if (d.trigger.test(text)) hits.push(d.id);
    if (hits.length >= max) break;
  }
  return hits;
}

/** Load the routed datasets. A loader that fails degrades to `{unavailable}` — never throws. */
export async function loadDatasets(ids: DatasetId[], q: DatasetQuery): Promise<Record<string, unknown>> {
  if (datasetsDisabled()) return {};
  const out: Record<string, unknown> = {};
  const wanted = ids.filter((id) => BY_ID.has(id));
  await Promise.all(
    wanted.map(async (id) => {
      try {
        out[id] = await BY_ID.get(id)!.load(q);
      } catch (e) {
        out[id] = { unavailable: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return out;
}
