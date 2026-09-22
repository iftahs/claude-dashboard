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
import { buildContributors } from './contributors.ts';
import { getCommandUsage } from './history.ts';
import { getWorkspaceTasks, getInventory } from './workspace.ts';
import { getWorkflowStats, type WorkflowRunSummary } from './workflows.ts';
import { fetchLiveUsage } from './scan.ts';

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
  /** Goes VERBATIM into the catalog the model always sees. */
  describes: string;
  /** Lexical route — free, deterministic, works on every backend. */
  trigger: RegExp;
  load: (q: DatasetQuery) => Promise<unknown>;
}

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
//   - insights builders are called WITHOUT `now` (they default it).
// The five `limit: Infinity` variants get their own ':full' keys because their
// output differs from what the routes cache under the bare name.

async function scopedInsights(source: SourceFilter) {
  const { insights } = await getInsights();
  return scopeInsights(insights, source);
}

// ── Row projections (the allowlist) ──────────────────────────────────────────

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
    trigger: /\bwork[\s-]?flows?\b|\borchestrat|\bwf_|\bagent[\s-]?swarms?\b|\bfan[\s-]?out\b|\bmulti[\s-]?agent\b/i,
    async load({ limit }) {
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
      const d = await scopedInsights(source);
      const e = memoBuilder('errors:full', [days, source], insightsFingerprint(), () =>
        buildErrors(d, days, undefined, Number.POSITIVE_INFINITY),
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
    trigger: /\bretr(y|ies|ied)\b|\bone[\s-]?shot\b|\bwasted?\b|\bre[\s-]?edit/i,
    async load({ days, source }) {
      const d = await scopedInsights(source);
      const r = memoBuilder('retries', [days, source], insightsFingerprint(), () => buildRetries(d, days));
      return {
        window: win(days, Date.now()),
        source,
        totalEdits: r.totalEdits,
        retried: r.retried,
        oneShotRatePct: pct(r.oneShotRate),
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
      const d = await scopedInsights(source);
      const rows = memoBuilder('branches:full', [days, source], insightsFingerprint(), () =>
        buildBranches(d, days, undefined, Number.POSITIVE_INFINITY),
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
      const d = await scopedInsights(source);
      const c = memoBuilder('churn:full', [days, source], insightsFingerprint(), () =>
        buildFileChurn(d, days, undefined, Number.POSITIVE_INFINITY),
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
    trigger: /\bsessions?\b|\bconversations?\b|\bchats?\b|\bcomplexit|\bheaviest\b|\blongest\b/i,
    async load({ days, source, limit }) {
      const d = await scopedInsights(source);
      const rows = memoBuilder('complexity:full', [days, source], insightsFingerprint(), () =>
        buildComplexity(d, days, undefined, Number.POSITIVE_INFINITY),
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
    trigger: /\bslash\b|\bcommands?\b|\bskills?\b|\/\w+/i,
    async load({ days, limit }) {
      const c = await soft(() => getCommandUsage(days));
      if (!c) return { unavailable: 'command history could not be read in time' };
      return {
        window: win(days, Date.now()),
        source: 'account',
        scopeNote: 'Read from the CLI history file — it is not split by surface.',
        totalCommands: c.totalCommands,
        uniqueCommands: c.uniqueCommands,
        commands: topN(c.commands, limit, 'count desc', (rest) => ({ count: rest.reduce((s, x) => s + x.count, 0) })),
      };
    },
  },
  {
    id: 'subagents',
    describes: 'Subagent delegation: how many Task subagents were spawned, by agent type and by model, and the share of sessions that delegate.',
    trigger: /\bsub[\s-]?agents?\b|\bdelegat|\btask tool\b|\bspawn/i,
    async load({ days, source }) {
      const d = await scopedInsights(source);
      const s = memoBuilder('subagents', [days, source], insightsFingerprint(), () => buildSubagentStats(d, days));
      return {
        window: win(days, Date.now()),
        source,
        spawns: s.spawns,
        byType: s.byType,
        byModel: s.byModel,
        avgPerSession: s.avgPerSession,
        delegationRatePct: pct(s.delegationRate),
      };
    },
  },
  {
    id: 'mcp',
    describes: 'MCP vs built-in tool split: how many calls went to MCP servers vs built-in tools, and per-MCP-server call and error counts.',
    trigger: /\bmcp\b|\bservers?\b|\bbuilt[\s-]?in\b|\bintegrations?\b/i,
    async load({ days, source, limit }) {
      const d = await scopedInsights(source);
      const m = memoBuilder('mcp', [days, source], insightsFingerprint(), () => buildMcp(d, days));
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
    trigger: /\breject|\bdenied?\b|\bpermissions?\b|\bblocked\b/i,
    async load({ days, source, limit }) {
      const d = await scopedInsights(source);
      const r = memoBuilder('rejections', [days, source], insightsFingerprint(), () => buildRejections(d, days));
      return {
        window: win(days, Date.now()),
        source,
        total: r.total,
        perTool: topN(r.perTool, limit, 'rejections desc'),
      };
    },
  },
  {
    id: 'languages',
    describes: 'Language / file-type breakdown: which languages were edited and read most.',
    trigger: /\blanguages?\b|\bfile[\s-]?types?\b|\btypescript\b|\bpython\b|\bwhat.*(do i|am i) (writ|cod)/i,
    async load({ days, source, limit }) {
      const d = await scopedInsights(source);
      const langs = memoBuilder('languages', [days, source], insightsFingerprint(), () => buildLanguages(d, days));
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
      const d = await scopedInsights(source);
      const y = memoBuilder('yield:full', [days, source], insightsFingerprint(), () =>
        buildYield(d, days, undefined, Number.POSITIVE_INFINITY),
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
    trigger: /\bcontribut|\bwhat.?s driving\b|\bdrives?\b|\bwhat.*(using|eating|burning).*(limit|quota)\b/i,
    async load({ source, limit }) {
      const { events, computedAt } = await getEvents();
      const c = memoBuilder('contributors', [source], eventsFingerprint(), () =>
        buildContributors(filterSource(events, source), computedAt),
      );
      const projectWindow = (w: typeof c.day) => ({
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
        window: 'native',
        source,
        scopeNote: 'IGNORES the chat window: `day` is the last 24h and `week` is the last 7 days, always.',
        day: projectWindow(c.day),
        week: projectWindow(c.week),
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
    trigger: /\blimits?\b|\bquota\b|\brate[\s-]?limit\b|\breset/i,
    async load() {
      const live: any = await soft(fetchLiveUsage);
      if (!live || live.error) return { unavailable: String(live?.error ?? 'live usage API unreachable') };
      return {
        window: 'native',
        source: 'account',
        scopeNote: 'Live from Anthropic, covers the whole account across all surfaces. IGNORES the chat scope.',
        fiveHourPct: live.five_hour?.utilization ?? null,
        fiveHourResetsAt: live.five_hour?.resets_at ?? null,
        sevenDayPct: live.seven_day?.utilization ?? null,
        sevenDayResetsAt: live.seven_day?.resets_at ?? null,
        sevenDayOpusPct: live.seven_day_opus?.utilization ?? null,
        extraUsageEnabled: live.extra_usage?.is_enabled ?? null,
        extraUsagePct: live.extra_usage?.utilization ?? null,
      };
    },
  },
  {
    id: 'tasks',
    describes: 'Tasks & plans backlog: task count by status, completion rate, blocked tasks, and saved plan files.',
    trigger: /\btasks?\b|\bplans?\b|\bbacklog\b|\bblocked\b|\btodos?\b/i,
    async load({ limit }) {
      const t = await soft(getWorkspaceTasks);
      if (!t) return { unavailable: 'workspace tasks could not be read in time' };
      return {
        window: 'all-time',
        source: 'account',
        totalTasks: t.tasks.total,
        byStatus: t.tasks.byStatus,
        completionRatePct: pct(t.tasks.completionRate),
        blocked: t.tasks.items.filter((i) => i.blocked).map((i) => ({ subject: i.subject, status: i.status })),
        tasks: topN(t.tasks.items.map((i) => ({ subject: i.subject, status: i.status, blocked: i.blocked })), limit, 'insertion order'),
        totalPlans: t.plans.total,
        plans: topN(t.plans.items.map((p) => ({ title: p.title, ageDays: p.ageDays })), limit, 'insertion order'),
      };
    },
  },
  {
    id: 'plugins',
    describes: 'Installed inventory: plugins, their marketplaces, configured MCP servers, and active hooks.',
    trigger: /\bplugins?\b|\bmarketplaces?\b|\binventory\b|\bhooks?\b|\binstalled\b/i,
    async load() {
      const inv = await soft(getInventory);
      if (!inv) return { unavailable: 'inventory could not be read in time' };
      return {
        window: 'all-time',
        source: 'account',
        plugins: inv.plugins.map((p) => ({ name: p.name, marketplace: p.marketplace, version: p.version })),
        enabledPlugins: inv.enabledPlugins,
        marketplaces: inv.marketplaces,
        mcpServers: inv.mcpServers,
        hooks: inv.hooks,
        model: inv.model,
        effortLevel: inv.effortLevel,
      };
    },
  },
];

const BY_ID = new Map(DATASETS.map((d) => [d.id, d]));

export const CATALOG: { id: DatasetId; describes: string }[] = DATASETS.map((d) => ({
  id: d.id,
  describes: d.describes,
}));

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
