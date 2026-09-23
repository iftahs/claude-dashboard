/**
 * ai-context.ts — the payload and prompts behind AI Insights.
 *
 * The model sees three things, always in one single-shot prompt:
 *   1. an OVERVIEW of the account over ONE window (scope.days) on ONE surface
 *      (scope.source) — every number in it is comparable to every other;
 *   2. a CATALOG of every dataset the dashboard tracks, each flagged loaded or
 *      not — so a retrieval miss becomes "I do track that, ask me about it"
 *      instead of "the dashboard doesn't break things down that way";
 *   3. the DETAIL blocks the router actually pulled (see ai-datasets.ts).
 *
 * Aggregates only: no transcripts, no full project paths (basenames only), no
 * session identifiers. The user opts in by asking, so sending these aggregates
 * to the model is acceptable; raw logs never leave the machine.
 */

import { getEvents, eventsFingerprint } from './cache.ts';
import { getInsights, insightsFingerprint } from './insights-scan.ts';
import { memoBuilder } from './builder-cache.ts';
import { buildWeekly, buildModels, buildProjectStats, filterSource, type SourceFilter } from './aggregate.ts';
import {
  buildErrors, buildRetries, buildMcp, buildYield, buildRejections, buildSubagentStats, buildToolUsage, scopeInsights,
} from './insights.ts';
import {
  catalogFor, codexLimitFields, loadDatasets, platformOf, readClaudeLive, readCodexLive, topN, datasetsDisabled,
  type AiPlatform, type CatalogEntry, type DatasetId, type LiveRead, type Slice,
} from './ai-datasets.ts';
import type { CodexLiveData } from './codex-live.ts';

export interface AiScope {
  source: SourceFilter;
  days: number;
}

/** One provider's live plan quota, as a percentage of its plan allowance. */
export interface LimitsBlock {
  provider: string;
  fiveHourPct: number | null;
  sevenDayPct: number | null;
  fiveHourResetsAt: string | null;
  sevenDayResetsAt: string | null;
  limitReached?: boolean;
  planType?: string | null;
  note: string;
}
type Unavailable = { unavailable: string };

export interface AiPayload {
  generatedAt: string;
  scope: { source: SourceFilter; platform: AiPlatform; windowDays: number; from: string; to: string; note: string };
  account: {
    windowDays: number;
    effectiveTokens: number;
    totalTokens: number;
    cacheReadTokens: number;
    estCostUsd: number;
    prevWindowEstCostUsd: number;
    weeklyResetsAt: string;
  };
  /** One block on a single platform; under both, one block per provider (never summed). */
  limits: LimitsBlock | Unavailable | { claude: LimitsBlock | Unavailable; codex: LimitsBlock | Unavailable };
  topModels: Slice<{ model: string; effectiveTokens: number; estCostUsd: number }>;
  topTools: Slice<{ name: string; count: number }>;
  topProjects: Slice<{ name: string; estCostUsd: number; effectiveTokens: number; sessions: number }>;
  behavior: {
    errorRatePct: number;
    /** null with no Claude edits in the window — always under Codex, whose patches never retry. */
    oneShotRatePct: number | null;
    wastedTokens: number;
    wastedEstCostUsd: number;
    /** Delegated work (Claude Task subagents, Codex non-Guardian subagents); null with no sessions. */
    delegationRatePct: number | null;
    /** Codex only: share of Codex threads with a Guardian auto-review. */
    autoReviewRatePct?: number | null;
    commitRatePct: number;
    rejections: number;
    mcpCalls: number;
    builtinCalls: number;
  };
  catalog: (CatalogEntry & { loaded: boolean })[];
  detail: Record<string, unknown>;
  notes: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (rate: number) => Math.round(rate * 1000) / 10;

const MAX_DETAIL_BYTES = Number(process.env.AI_MAX_DETAIL_BYTES || 24 * 1024);
const DETAIL_LIMIT_LADDER = [20, 10, 5];

const LIMITS_NOTE: Record<AiPlatform, string> = {
  claude:
    '`limits` is Anthropic\'s live account quota as a PERCENTAGE of a plan allowance. It covers every surface, ignores scope.source, and is a different unit from dollars — never mix the two.',
  codex:
    '`limits` is OpenAI\'s live Codex quota for the ChatGPT plan, as a PERCENTAGE of the plan allowance (a 5-hour and a weekly window). It covers Codex use from every ChatGPT app, ignores the chat window, and is a different unit from dollars — never mix the two.',
  both:
    '`limits` holds one block per provider — `claude` (Anthropic) and `codex` (OpenAI ChatGPT plan) — each a PERCENTAGE of its own plan allowance. They are separate quotas: never add, average or compare them as one number, and never mix them with dollars.',
};

/** The rules every payload carries, in the vocabulary of the platform it covers. */
function notesFor(p: AiPlatform): string[] {
  return [
    'Every number in `account`, `topModels`, `topTools`, `topProjects` and `behavior` covers EXACTLY scope.windowDays days on surface scope.source. Blocks inside `detail` state their own `window`/`source` whenever they differ. NEVER compare two numbers from different windows, and NEVER claim the data is inconsistent because of a window mismatch — check the windows first.',
    'Any list with truncated:true shows only the top `shown` of `total` rows sorted by `sortedBy`, with the remainder rolled up in `other`. Never state a total, a count, or a "that is all of them" claim that depends on the hidden rows.',
    ...(p === 'codex'
      ? ['A catalog entry with `unavailable` is a Claude Code feature with no Codex equivalent — say so plainly; never answer it with Claude data.']
      : [
          'Workflow tokens and costs are a SUBSET of the account totals, never an addition — do not add them together.',
          'Project stats exclude Cowork sessions (their paths are sandbox-internal), so per-project costs can sum to LESS than the account total. That is expected, not a bug.',
        ]),
    LIMITS_NOTE[p],
    p === 'claude'
      ? 'All costs are ESTIMATED equivalent-API costs. This is a subscription with no per-token bill.'
      : 'All costs are ESTIMATED equivalent-API costs at list API prices (Codex: OpenAI\'s). A plan subscription has no per-token bill.',
  ];
}

// ── Payload cache ────────────────────────────────────────────────────────────
// buildAiPayload runs a dozen O(events) builders. Every builder call below goes
// through memoBuilder (sharing the dashboard's warm entries), and the assembled
// payload is itself cached so /api/ai/chat and the /api/ai/suggestions call that
// immediately follows it don't both pay for assembly.

interface CacheEntry {
  at: number;
  payload: AiPayload;
}
const payloadCache = new Map<string, CacheEntry>();
const PAYLOAD_TTL = 5_000;
const PAYLOAD_MAX = 8;

export async function buildAiPayload(
  scope: AiScope,
  ids: DatasetId[],
  opts?: { redact?: boolean },
): Promise<AiPayload> {
  const redact = !!opts?.redact;
  const key = [
    scope.source,
    scope.days,
    redact,
    [...ids].sort().join(','),
    eventsFingerprint(),
    insightsFingerprint(),
  ].join('|');

  const hit = payloadCache.get(key);
  if (hit && Date.now() - hit.at < PAYLOAD_TTL) return hit.payload;

  const payload = await assemble(scope, ids, redact);
  if (payloadCache.size >= PAYLOAD_MAX) payloadCache.clear();
  payloadCache.set(key, { at: Date.now(), payload });
  return payload;
}

async function assemble(scope: AiScope, ids: DatasetId[], redact: boolean): Promise<AiPayload> {
  const { source, days } = scope;
  const [{ events, computedAt }, { insights }] = await Promise.all([getEvents(), getInsights()]);

  // ONE window, ONE surface, driving every overview builder. The old context mixed
  // a 7-day account total with 30-day project costs and labelled both "7 days",
  // which is what made the model report a phantom inconsistency.
  const scoped = filterSource(events, source);
  const si = scopeInsights(insights, source);
  const fp = eventsFingerprint();
  const ifp = insightsFingerprint();

  const weekly = memoBuilder('weekly', [days, source], fp, () => buildWeekly(scoped, computedAt, days));
  const models = memoBuilder('models', [days, source], fp, () => buildModels(scoped, computedAt, days));
  const projects = memoBuilder('projects', [days, source], fp, () => buildProjectStats(scoped, computedAt, days));

  const tools = memoBuilder('tools', [days, source], ifp, () => buildToolUsage(si, days, computedAt));
  const errors = memoBuilder('errors', [days, source], ifp, () => buildErrors(si, days, computedAt));
  const retries = memoBuilder('retries', [days, source], ifp, () => buildRetries(si, days, computedAt));
  const mcp = memoBuilder('mcp', [days, source], ifp, () => buildMcp(si, days, computedAt));
  const yld = memoBuilder('yield', [days, source], ifp, () => buildYield(si, days, computedAt));
  const rej = memoBuilder('rejections', [days, source], ifp, () => buildRejections(si, days, computedAt));
  const sub = memoBuilder('subagents', [days, source], ifp, () => buildSubagentStats(si, days, computedAt));

  const platform = platformOf(source);
  const notes = notesFor(platform);
  const detail = await loadDetail(ids, { days, source, redact }, notes);
  const loaded = new Set(Object.keys(detail));
  const live = await liveReads(platform);

  return {
    generatedAt: new Date(computedAt).toISOString(),
    scope: {
      source,
      platform,
      windowDays: days,
      from: new Date(weekly.rangeFrom).toISOString(),
      to: new Date(weekly.rangeTo).toISOString(),
      note:
        source === 'all'
          ? 'Every surface: Claude Code, Cowork and Codex (ChatGPT desktop).'
          : source === 'claude'
            ? 'Claude only — Claude Code and Cowork (Codex excluded).'
          : source === 'code'
            ? 'Claude Code only (Cowork and Codex excluded).'
            : source === 'codex'
              ? 'Codex (ChatGPT desktop) only — OpenAI models; Claude Code and Cowork excluded.'
              : 'Cowork only (Claude Code and Codex excluded).',
    },
    account: {
      windowDays: days,
      effectiveTokens: weekly.totals.effectiveTokens,
      totalTokens: weekly.totals.totalTokens,
      cacheReadTokens: weekly.totals.cacheReadTokens,
      estCostUsd: round2(weekly.totals.cost),
      prevWindowEstCostUsd: round2(weekly.prevTotals.cost),
      weeklyResetsAt: weeklyResetFor(platform, live, weekly.weeklyResetsAt),
    },
    limits: liveLimits(platform, live),
    topModels: topN(
      models.models.map((m) => ({ model: m.model, effectiveTokens: m.effectiveTokens, estCostUsd: round2(m.cost) })),
      6,
      'estCostUsd desc',
      (rest) => ({ estCostUsd: round2(rest.reduce((s, m) => s + m.estCostUsd, 0)) }),
    ),
    topTools: topN(tools.tools, 10, 'count desc', (rest) => ({ count: rest.reduce((s, t) => s + t.count, 0) })),
    topProjects: topN(
      projects.projects.map((p) => ({
        name: p.name,
        estCostUsd: round2(p.cost),
        effectiveTokens: p.effectiveTokens,
        sessions: p.sessionCount,
      })),
      8,
      'estCostUsd desc',
      (rest) => ({ estCostUsd: round2(rest.reduce((s, p) => s + p.estCostUsd, 0)) }),
    ),
    behavior: {
      errorRatePct: pct(errors.errorRate),
      oneShotRatePct: retries.oneShotRate === null ? null : pct(retries.oneShotRate),
      wastedTokens: retries.wastedTokens,
      wastedEstCostUsd: round2(retries.wastedCost),
      delegationRatePct: sub.delegation.rate === null ? null : pct(sub.delegation.rate),
      ...(platform === 'claude' ? {} : { autoReviewRatePct: sub.autoReview.rate === null ? null : pct(sub.autoReview.rate) }),
      commitRatePct: pct(yld.rate),
      rejections: rej.total,
      mcpCalls: mcp.mcpCalls,
      builtinCalls: mcp.builtinCalls,
    },
    catalog: catalogFor(source).map((c) => ({ ...c, loaded: loaded.has(c.id) })),
    detail,
    notes,
  };
}

/** The live plan reads a scope needs — Anthropic's, OpenAI's, or both. Never throws. */
interface LiveReads {
  claude?: LiveRead<any>;
  codex?: LiveRead<CodexLiveData>;
}

async function liveReads(p: AiPlatform): Promise<LiveReads> {
  const [claude, codex] = await Promise.all([
    p === 'codex' ? undefined : readClaudeLive(),
    p === 'claude' ? undefined : readCodexLive(),
  ]);
  return { claude, codex };
}

function claudeBlock(live: LiveRead<any>): LimitsBlock | Unavailable {
  if (!('usage' in live)) return live;
  const u = live.usage;
  return {
    provider: 'Anthropic — Claude.ai plan',
    fiveHourPct: u.five_hour?.utilization ?? null,
    sevenDayPct: u.seven_day?.utilization ?? null,
    fiveHourResetsAt: u.five_hour?.resets_at ?? null,
    sevenDayResetsAt: u.seven_day?.resets_at ?? null,
    note: 'Live Anthropic account quota, as a percentage of the plan allowance. Covers all surfaces; ignores scope.source. Not dollars.',
  };
}

function codexBlock(live: LiveRead<CodexLiveData>): LimitsBlock | Unavailable {
  if (!('usage' in live)) return live;
  const f = codexLimitFields(live.usage);
  return {
    provider: f.provider,
    fiveHourPct: f.fiveHourPct,
    sevenDayPct: f.sevenDayPct,
    fiveHourResetsAt: f.fiveHourResetsAt,
    sevenDayResetsAt: f.sevenDayResetsAt,
    limitReached: f.limitReached,
    planType: f.planType,
    note: `OpenAI's Codex quota for the ChatGPT plan (${f.origin}), as a percentage of the plan allowance; sevenDay = the weekly window. Ignores scope.source. Not dollars.`,
  };
}

/**
 * The live quota of the provider(s) the chat is scoped to — the single most-asked
 * thing. Under Codex it is OpenAI's windows, never Anthropic's.
 */
function liveLimits(p: AiPlatform, live: LiveReads): AiPayload['limits'] {
  const unread: Unavailable = { unavailable: 'live usage was not read' };
  const claude = live.claude ? claudeBlock(live.claude) : unread;
  const codex = live.codex ? codexBlock(live.codex) : unread;
  if (p === 'claude') return claude;
  if (p === 'codex') return codex;
  return { claude, codex };
}

/**
 * The weekly reset the account block states: the provider's live weekly reset on
 * a single platform, else the nominal Monday (under both, each limits block
 * carries its own provider's reset).
 */
function weeklyResetFor(p: AiPlatform, live: LiveReads, fallbackMs: number): string {
  if (p === 'claude') return weeklyResetIso(live.claude && 'usage' in live.claude ? live.claude.usage : null, fallbackMs);
  if (p === 'codex') {
    const codex = live.codex && 'usage' in live.codex ? live.codex.usage : null;
    return weeklyResetIso(codex?.weekly ? { seven_day: { resets_at: codex.weekly.resetsAt } } : null, fallbackMs);
  }
  return new Date(fallbackMs).toISOString();
}

/**
 * Anthropic's live `seven_day.resets_at` when the usage API has one, else
 * buildWeekly's nominal Monday 01:00 UTC. The real window is anchored per
 * account and can land hours off that, so the model gets the live value.
 */
export function weeklyResetIso(usage: any, fallbackMs: number): string {
  const live = Date.parse(usage?.seven_day?.resets_at ?? '');
  return new Date(Number.isFinite(live) ? live : fallbackMs).toISOString();
}

/**
 * Load the routed datasets under a byte budget. Shrinking the per-list limit is
 * tried first; only when that isn't enough do we drop whole datasets — and a
 * dropped dataset is *named* in the notes and flips to loaded:false in the
 * catalog, so it degrades to honest rather than invisible.
 */
async function loadDetail(
  ids: DatasetId[],
  base: { days: number; source: SourceFilter; redact: boolean },
  notes: string[],
): Promise<Record<string, unknown>> {
  if (ids.length === 0) return {};
  if (datasetsDisabled()) {
    notes.push('Detail datasets are disabled on this server (AI_DATASETS_DISABLED=1); only the overview is available.');
    return {};
  }

  let detail: Record<string, unknown> = {};
  for (const limit of DETAIL_LIMIT_LADDER) {
    detail = await loadDatasets(ids, { ...base, limit });
    if (JSON.stringify(detail).length <= MAX_DETAIL_BYTES) return detail;
  }

  const [first, ...dropped] = ids;
  if (dropped.length > 0) {
    notes.push(
      `Detail for ${dropped.join(', ')} was dropped to fit the context budget — say so and offer to answer about them one at a time.`,
    );
  }
  return loadDatasets([first], { ...base, limit: DETAIL_LIMIT_LADDER[DETAIL_LIMIT_LADDER.length - 1] });
}

// ── Prompt templates ──────────────────────────────────────────────────────────

/** What the dashboard is showing, in the words each prompt uses. */
const PRODUCT: Record<AiPlatform, string> = {
  claude: 'Claude Code',
  codex: "Codex (OpenAI's coding agent in the ChatGPT desktop app)",
  both: "Claude Code and Codex (OpenAI's coding agent in the ChatGPT desktop app)",
};

/** The general-knowledge questions the chat may answer on each platform — never refuse these. */
const GENERAL_TOPICS: Record<AiPlatform, string> = {
  claude: 'Claude, Claude Code, the Anthropic API, or Anthropic models',
  codex: 'Codex, the ChatGPT desktop app, ChatGPT plans and their Codex limits, the OpenAI API, or OpenAI models',
  both:
    'Claude, Claude Code, the Anthropic API or Anthropic models, and Codex, the ChatGPT desktop app, ChatGPT plans, the OpenAI API or OpenAI models',
};

const REFUSAL_TOPICS: Record<AiPlatform, string> = {
  claude: 'general Claude / Claude Code questions',
  codex: 'general Codex / OpenAI questions',
  both: 'general Claude / Claude Code and Codex / OpenAI questions',
};

const VOCABULARY: Record<AiPlatform, string> = {
  claude:
    'VOCABULARY IS EXACT. A "workflow" is one run of the workflow-orchestration tool (a generated script that fans out subagents across phases). ' +
    'A "project" is a repo directory. A "session" is one CLI conversation. A "subagent" is a Task spawn.',
  codex:
    'VOCABULARY IS EXACT. A "project" is a repo directory (a thread\'s working directory). A "session" is one Codex thread. ' +
    'A Codex "subagent" is usually a Guardian auto-review — a safety check of a planned action, NOT delegated work. ' +
    'Workflows and task lists are Claude Code features with no Codex equivalent.',
  both:
    'VOCABULARY IS EXACT. A "workflow" is one run of Claude Code\'s workflow-orchestration tool (Claude only). A "project" is a repo directory. ' +
    'A "session" is one Claude Code conversation or one Codex thread. A "subagent" is a Claude Task spawn, or on Codex usually a Guardian ' +
    'auto-review (a safety check, NOT delegated work). Claude and Codex rate limits are separate quotas.',
};

/** The chat's system prompt, in the vocabulary of the platform the chat is scoped to. */
export function chatSystem(source: SourceFilter): string {
  const p = platformOf(source);
  return [
    `You are an analyst embedded in a personal ${PRODUCT[p]} usage dashboard.`,
    'You answer ONLY two kinds of questions:',
    `(1) Questions about the user's ${PRODUCT[p]} usage — answer using ONLY the JSON payload provided (aggregate metrics; no file contents, no transcripts).`,
    `(2) General questions about ${GENERAL_TOPICS[p]} — answer from your own knowledge.`,
    `For ANYTHING else (weather, news, trivia, unrelated coding help, math puzzles) do NOT answer: reply in one short sentence that you only cover the usage data shown here and ${REFUSAL_TOPICS[p]}.`,
    '',
    VOCABULARY[p],
    'If the user asks about one of these, NEVER answer about another. If you need a dataset you were not given, say so — do not substitute a different one.',
    '',
    '`catalog` lists EVERY dataset this dashboard tracks, each with loaded:true or loaded:false.',
    'NEVER say the dashboard does not track something that appears in the catalog.',
    'If you need an entry whose loaded is false, do not guess and do not deny it exists — say the dashboard does track it and ask the user to re-ask naming it (e.g. "ask me about file churn").',
    ...(p === 'claude' ? [] : ['An entry with `unavailable` has no data on this platform: say why (its `unavailable` text) instead of answering it.']),
    '',
    'Obey every string in `notes`.',
    'Lists are already sorted — the answer to a "most/biggest/worst X" question is the first item of the relevant list; do not re-derive it.',
    p === 'claude'
      ? 'Costs are ESTIMATED equivalent API costs; the user is on a subscription with no per-token bill — say "estimated" when quoting money.'
      : 'Costs are ESTIMATED equivalent API costs at list API prices, not a bill — say "estimated" when quoting money.',
    '"Effective tokens" = input + output + cache-writes (what counts toward rate limits); cache reads are excluded.',
    'Name the window with every number you quote. Never invent numbers.',
    'Be concise (~6 sentences max, or a short list). If the payload cannot answer a usage question, say so plainly.',
  ].join(' ');
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function buildChatUserMessage(payload: AiPayload, question: string, history?: ChatTurn[]): string {
  const h = history && history.length
    ? `\n\nEarlier in this conversation:\n${history.slice(-12).map((m) => `${m.role}: ${m.content}`).join('\n')}`
    : '';
  return `USAGE PAYLOAD (JSON):\n${JSON.stringify(scrubForModel(payload))}${h}\n\nQUESTION: ${question}`;
}

/**
 * The ✨ section-insight system prompt. `source` is the platform the panel shows;
 * without one (an older client) the wording names no platform at all.
 */
export function sectionSystem(source?: SourceFilter): string {
  const what = source ? `a ${PRODUCT[platformOf(source)]} usage dashboard` : 'an AI coding-assistant usage dashboard';
  return (
    `You explain one panel of ${what} in plain language. Use ONLY the JSON provided ` +
    '(aggregate metrics, no transcripts). Costs are estimated equivalent API costs (subscription, no real bill). ' +
    'Be specific with the numbers; no preamble, no markdown headers — 2-3 sentences.'
  );
}

const SECTION_PROMPTS: Record<string, string> = {
  models: 'Summarize this model-usage breakdown: which model dominates, where cost concentrates, one suggestion.',
  trends: 'Summarize this daily usage trend: direction vs the previous period and any notable spike.',
  tools: 'Summarize this tool-usage breakdown: dominant tools and whether the mix looks healthy.',
  errors: 'Summarize this error breakdown: overall rate, the worst tool/category, one concrete fix.',
  retries: 'Summarize this edit-retry analysis: one-shot rate, wasted tokens, one way to reduce retries.',
  projects: 'Summarize this per-project cost breakdown: where spend concentrates and any outlier.',
  subagents: 'Summarize this subagent delegation analysis in plain language.',
  branches: 'Summarize this per-branch usage breakdown.',
  mcp: 'Summarize this MCP-vs-built-in tool split.',
  yield: 'Summarize this committed-vs-uncommitted yield analysis.',
  rejections: 'Summarize this permission-rejections breakdown.',
  languages: 'Summarize this language / file-type edit breakdown.',
  cache: 'Summarize this cache-efficiency trend.',
  commands: 'Summarize this slash-command / skill usage breakdown.',
  churn: 'Summarize this file-churn breakdown: the most-edited files and what that implies.',
  complexity: 'Summarize this session-complexity data: which sessions are heaviest (tool calls, tokens, subagents) and what drives complexity.',
  tasks: 'Summarize this tasks & plans overview: completion rate, any blocked tasks, and the plan backlog.',
  plugins: 'Summarize this plugins & MCP inventory: installed plugins, MCP servers and any notable integrations.',
  workflows: 'Summarize these workflow orchestration runs: which run cost the most, subagent counts, success rate, one takeaway.',
};

// Keys that may carry full paths or session identifiers. The privacy contract is
// that those never leave the machine, so strip them from anything bound for an
// external model. Defense-in-depth only — this is a key-name blocklist and cannot
// see a path embedded inside a string VALUE. The allowlist projections in
// ai-datasets.ts are the real boundary.
const SENSITIVE_KEYS = new Set(
  [
    'path', 'filePath', 'fullPath', 'projectPath', 'project_path', 'cwd', 'sessionId', 'transcriptPath',
    'runId', 'agentId', 'transcript', 'firstPrompt', 'logsTail',
  ].map((k) => k.toLowerCase()),
);

export function scrubForModel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubForModel);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) continue;
      out[k] = scrubForModel(v);
    }
    return out;
  }
  return value;
}

export function buildSectionUserMessage(section: string, data: unknown): string {
  const instr = SECTION_PROMPTS[section] ?? 'Summarize this dashboard panel data in 2-3 plain-language sentences.';
  return `${instr}\n\nDATA (JSON):\n${JSON.stringify(scrubForModel(data))}`;
}

// ── Follow-up suggestions ───────────────────────────────────────────────────

const KNOWLEDGE: Record<AiPlatform, string> = {
  claude: 'general Claude / Claude Code knowledge',
  codex: 'general Codex / OpenAI knowledge',
  both: 'general Claude / Claude Code or Codex / OpenAI knowledge',
};

/** The follow-up-chip system prompt for the platform the chat is scoped to. */
export function suggestSystem(source: SourceFilter): string {
  const p = platformOf(source);
  const nouns = p === 'codex' ? '"thread", "project" or "branch"' : '"workflow", "session", "project" or "branch"';
  return [
    `You suggest follow-up questions for a ${PRODUCT[p]} usage dashboard chat.`,
    'Based on the conversation so far (and the usage payload), propose 3 short, specific follow-up questions the user is likely to ask next —',
    'they should flow naturally from what was just discussed (drill deeper, compare, or a logical next step).',
    `Every question must be answerable from the usage payload, from a dataset listed in its \`catalog\`, or from ${KNOWLEDGE[p]} — never off-topic.`,
    `A question is only answerable if it names its dataset the way the catalog does (say ${nouns} explicitly).`,
    'Return ONLY a JSON array of exactly 3 strings, each under 60 characters, e.g. ["...","...","..."]. No numbering, no prose, no markdown.',
  ].join(' ');
}

export function buildSuggestMessage(payload: AiPayload, history: ChatTurn[]): string {
  const h = history.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n');
  const slim = {
    scope: payload.scope,
    account: payload.account,
    // Only what can be asked on this platform — a Claude-only dataset is no follow-up under Codex.
    catalog: payload.catalog.filter((c) => !c.unavailable).map((c) => c.id),
  };
  return `USAGE PAYLOAD (JSON):\n${JSON.stringify(slim)}\n\nCONVERSATION SO FAR:\n${h}\n\nReturn 3 follow-up questions as a JSON array of strings.`;
}
