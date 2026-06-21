/**
 * ai-context.ts — privacy-safe usage summary + prompt templates for AI Insights.
 *
 * The context is AGGREGATES ONLY (no transcripts, no full project paths — project
 * basenames only). The user opts in by asking/clicking, so sending these
 * aggregates to the model is acceptable; raw logs never leave the machine.
 */

import { getEvents } from './cache.ts';
import { getInsights } from './insights-scan.ts';
import { buildWeekly, buildModels, buildTools, buildProjectStats } from './aggregate.ts';
import { buildErrors, buildRetries, buildLanguages, buildMcp, buildYield, buildRejections, buildSubagentStats } from './insights.ts';

export interface AiContext {
  generatedAt: string;
  window: { weeklyDays: number; insightsDays: number };
  totals: { weeklyEffectiveTokens: number; weeklyCost: number; prevWeeklyCost: number };
  topModels: { model: string; effectiveTokens: number; cost: number }[];
  topTools: { name: string; count: number }[];
  topProjects: { name: string; cost: number; effectiveTokens: number; sessionCount: number }[];
  behavior: {
    errorRate: number;
    oneShotRate: number;
    wastedTokens: number;
    wastedCost: number;
    delegationRate: number;
    commitRate: number;
    rejections: number;
    topLanguages: { language: string; edits: number }[];
    mcp: { builtinCalls: number; mcpCalls: number };
  };
}

export async function buildAiContext(now = Date.now()): Promise<AiContext> {
  // Independent cache reads — run them together so a cold cache scans once in parallel.
  const [{ events }, { insights }] = await Promise.all([getEvents(), getInsights()]);

  const weekly = buildWeekly(events, now, 7);
  const models = buildModels(events, now, 7);
  const tools = buildTools(events, now, 7);
  const projects = buildProjectStats(events, now, 30);

  const errors = buildErrors(insights, 7);
  const retries = buildRetries(insights, 7);
  const langs = buildLanguages(insights, 7);
  const mcp = buildMcp(insights, 7);
  const yld = buildYield(insights, 7);
  const rej = buildRejections(insights, 7);
  const sub = buildSubagentStats(insights, 7);

  return {
    generatedAt: new Date(now).toISOString(),
    window: { weeklyDays: 7, insightsDays: 7 },
    totals: {
      weeklyEffectiveTokens: weekly.totals.effectiveTokens,
      weeklyCost: weekly.totals.cost,
      prevWeeklyCost: weekly.prevTotals.cost,
    },
    topModels: models.models.slice(0, 6).map((m) => ({ model: m.model, effectiveTokens: m.effectiveTokens, cost: m.cost })),
    topTools: tools.tools.slice(0, 10),
    topProjects: projects.projects.slice(0, 8).map((p) => ({
      name: p.name,
      cost: p.cost,
      effectiveTokens: p.effectiveTokens,
      sessionCount: p.sessionCount,
    })),
    behavior: {
      errorRate: errors.errorRate,
      oneShotRate: retries.oneShotRate,
      wastedTokens: retries.wastedTokens,
      wastedCost: retries.wastedCost,
      delegationRate: sub.delegationRate,
      commitRate: yld.rate,
      rejections: rej.total,
      topLanguages: langs.slice(0, 6).map((l) => ({ language: l.language, edits: l.edits })),
      mcp: { builtinCalls: mcp.builtinCalls, mcpCalls: mcp.mcpCalls },
    },
  };
}

// ── Prompt templates ──────────────────────────────────────────────────────────

export const CHAT_SYSTEM = [
  'You are an analyst embedded in a personal Claude Code usage dashboard.',
  'You answer ONLY two kinds of questions:',
  "(1) Questions about the user's Claude Code usage — answer using ONLY the JSON usage summary provided (aggregate metrics, no file contents or transcripts).",
  '(2) General questions about Claude, Claude Code, the Anthropic API, or Anthropic models — answer from your own knowledge.',
  'For ANYTHING else (weather, news, trivia, unrelated coding help, math puzzles, etc.) do NOT answer: reply in one short sentence that you only cover the usage data shown here and general Claude / Claude Code questions.',
  'Costs are ESTIMATED equivalent API costs; the user is on a subscription with no per-token bill — say "estimated" when quoting money.',
  '"Effective tokens" = input + output + cache-writes (counts toward limits); cache reads are excluded.',
  'Be concise (~6 sentences max, or a short list). If the data cannot answer a usage question, say so plainly. Never invent numbers.',
].join(' ');

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function buildChatUserMessage(ctx: AiContext, question: string, history?: ChatTurn[]): string {
  const h = history && history.length
    ? `\n\nEarlier in this conversation:\n${history.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n')}`
    : '';
  return `USAGE SUMMARY (JSON):\n${JSON.stringify(ctx)}${h}\n\nQUESTION: ${question}`;
}

export const SECTION_SYSTEM =
  'You explain one panel of a Claude Code usage dashboard in plain language. Use ONLY the JSON provided ' +
  '(aggregate metrics, no transcripts). Costs are estimated equivalent API costs (subscription, no real bill). ' +
  'Be specific with the numbers; no preamble, no markdown headers — 2-3 sentences.';

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
};

export function buildSectionUserMessage(section: string, data: unknown): string {
  const instr = SECTION_PROMPTS[section] ?? 'Summarize this dashboard panel data in 2-3 plain-language sentences.';
  return `${instr}\n\nDATA (JSON):\n${JSON.stringify(data)}`;
}

// ── Follow-up suggestions ───────────────────────────────────────────────────

export const SUGGEST_SYSTEM = [
  'You suggest follow-up questions for a Claude Code usage dashboard chat.',
  'Based on the conversation so far (and the usage summary), propose 3 short, specific follow-up questions the user is likely to ask next —',
  'they should flow naturally from what was just discussed (drill deeper, compare, or a logical next step).',
  'Every question must be answerable from the usage metrics OR from general Claude / Claude Code knowledge — never off-topic.',
  'Return ONLY a JSON array of exactly 3 strings, each under 60 characters, e.g. ["...","...","..."]. No numbering, no prose, no markdown.',
].join(' ');

export function buildSuggestMessage(ctx: AiContext, history: ChatTurn[]): string {
  const h = history.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n');
  return `USAGE SUMMARY (JSON):\n${JSON.stringify(ctx)}\n\nCONVERSATION SO FAR:\n${h}\n\nReturn 3 follow-up questions as a JSON array of strings.`;
}
