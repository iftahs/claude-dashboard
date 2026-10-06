import { PLATFORM_COLORS } from '@/lib/chart-theme';
import { compact, toolLabel, usd, ymdLabel } from '@/lib/format';
import { titleScope } from '@/lib/platform';
import type { Platform } from '@/lib/platform';
import type { SectionAi, SectionSkeleton, SectionState } from '@/lib/section';
import type {
  CommandUsageData,
  ComplexityPoint,
  FileChurnData,
  InsightKpis,
  InsightPlatform,
  InsightsBranches,
  InsightsErrors,
  InsightsLanguages,
  InsightsMcp,
  InsightsRejections,
  InsightsRetries,
  InsightsSummary,
  InsightsTurns,
  InsightsYield,
  LatencyStats,
  SubagentStats,
  ToolsData,
} from '@/types';

export type InsightDays = '7' | '14' | '30';
export type InsightView = 'reliability' | 'tools' | 'code' | 'pace';

export interface InsightDayOption {
  value: InsightDays;
  label: string;
}

export interface InsightViewTab {
  value: InsightView;
  label: string;
}

export const INSIGHT_DAY_OPTIONS: readonly InsightDayOption[] = [
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
];

export const DEFAULT_INSIGHT_VIEW: InsightView = 'reliability';
export const INSIGHT_VIEW_PARAM = 'view';
export const INSIGHT_VIEW_TABS: readonly InsightViewTab[] = [
  { value: 'reliability', label: 'Reliability' },
  { value: 'tools', label: 'Tools' },
  { value: 'code', label: 'Code' },
  { value: 'pace', label: 'Pace' },
];

export function parseInsightView(value: string | null): InsightView {
  return INSIGHT_VIEW_TABS.find((tab) => tab.value === value)?.value ?? DEFAULT_INSIGHT_VIEW;
}

export interface InsightPoll<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export type InsightValueTone = 'default' | 'muted' | 'subtle' | 'success' | 'warning' | 'danger';
export type InsightBarTone = 'accent' | 'warning' | 'danger' | 'success' | 'neutral' | 'codex';
export type InsightFactTone = 'default' | 'muted' | 'success' | 'warning' | 'danger';

export interface InsightRankedRow {
  key: string;
  label: string;
  title?: string;
  detail?: string;
  badge?: string;
  percent: number;
  tone?: InsightBarTone;
  value: string;
  valueTone?: InsightValueTone;
  secondary?: string;
  secondaryTone?: InsightValueTone;
}

export interface InsightFactView {
  key: string;
  label: string;
  value: string;
  tone: InsightFactTone;
  help: string | null;
}

export interface InsightSectionView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  ai: SectionAi | null;
}

interface SectionInput<T> {
  poll: InsightPoll<T>;
  platform: Platform;
  days: InsightDays;
  ai: SectionAi | null;
}

const SERVER_DOWN = 'The dashboard server did not answer. It keeps retrying.';
const PLATFORM_NAME: Record<InsightPlatform, string> = { claude: 'Claude', codex: 'Codex' };
const INSIGHT_PLATFORMS: readonly InsightPlatform[] = ['claude', 'codex'];

function windowLabel(days: InsightDays): string {
  return `last ${days} days`;
}

function pendingState<T>(
  poll: InsightPoll<T>,
  what: string,
  skeleton: SectionSkeleton,
  rows?: number,
  height?: number,
): SectionState | null {
  if (poll.data !== null) return null;
  if (poll.error && !poll.loading) return { kind: 'error', title: `Could not load ${what}`, description: SERVER_DOWN };
  return { kind: 'loading', skeleton, rows, height };
}

function share(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function estCost(amount: number): string {
  return amount === 0 ? '~$0' : `~${usd(amount)}`;
}

// A count and its unit stay on one line when a tile's context line wraps.
const NBSP = '\u00A0';

function pct(rate: number | null | undefined, digits = 1): string {
  return rate === null || rate === undefined ? 'n/a' : `${(rate * 100).toFixed(digits)}%`;
}

function splitLine(summary: InsightsSummary, pick: (kpis: InsightKpis) => number | null, digits = 1): string {
  const one = (kpis: InsightKpis | null) => (kpis ? pct(pick(kpis), digits) : '—');
  return `Claude${NBSP}${one(summary.byPlatform.claude)} · Codex${NBSP}${one(summary.byPlatform.codex)}`;
}

export type InsightKpiTone = 'default' | 'success' | 'warning' | 'danger';

export interface InsightKpiTileView {
  key: string;
  label: string;
  value: string;
  sub: string;
  tone: InsightKpiTone;
  help: string;
}

export type InsightKpisStatus = 'loading' | 'error' | 'ready';

export interface InsightKpisView {
  status: InsightKpisStatus;
  tiles: InsightKpiTileView[];
  errorTitle: string;
  errorDescription: string;
}

export const INSIGHT_KPI_COUNT = 4;

function kpiTiles(summary: InsightsSummary, platform: Platform): InsightKpiTileView[] {
  const both = platform === 'both';
  const failure: InsightKpiTileView = {
    key: 'failure',
    label: 'Failure rate',
    value: pct(summary.failureRate),
    sub: both
      ? splitLine(summary, (kpis) => kpis.failureRate)
      : `${compact(summary.failures)}${NBSP}failed / ${compact(summary.totalCalls)}${NBSP}calls`,
    tone: summary.failureRate === null ? 'default' : 'danger',
    help: 'Share of tool calls that ran and came back with an error. Rejections — calls declined before they ran — are not failures; they have their own rate. Lower is better.',
  };

  const rejection: InsightKpiTileView = {
    key: 'rejection',
    label: 'Rejection rate',
    value: pct(summary.rejectionRate),
    sub: both
      ? splitLine(summary, (kpis) => kpis.rejectionRate)
      : `${compact(summary.rejections)}${NBSP}${platform === 'codex' ? 'stopped' : 'declined'} / ${compact(summary.totalCalls)}${NBSP}calls`,
    tone: summary.rejectionRate === null ? 'default' : 'warning',
    help:
      platform === 'codex'
        ? 'Share of Codex actions that never ran: denied by the guardian auto-reviewer, or declined by you when Codex asked.'
        : both
          ? 'Share of tool calls that never ran: Claude permission prompts you declined, and Codex actions its guardian auto-reviewer denied or you declined.'
          : 'Share of tool calls you declined when Claude asked for permission.',
  };

  const commit: InsightKpiTileView = {
    key: 'commit',
    label: 'Commit rate',
    value: pct(summary.commitRate, 0),
    sub: both ? splitLine(summary, (kpis) => kpis.commitRate, 0) : 'of sessions in a git repo',
    tone: summary.commitRate === null ? 'default' : 'success',
    help: 'Share of sessions in a git repo that ran a successful git commit — a proxy for work that landed. Sessions outside any repo (a chat in a scratch folder) could never commit and are left out.',
  };

  const delegation: InsightKpiTileView =
    platform === 'codex'
      ? {
          key: 'delegation',
          label: 'Auto-review',
          value: pct(summary.autoReviewRate, 0),
          sub: 'of threads got a guardian review',
          tone: 'default',
          help: "Share of Codex threads the guardian auto-reviewer checked at least once — the ChatGPT desktop app's approval pass over the actions a turn wants to take. Each verdict is one review.",
        }
      : both
        ? {
            key: 'delegation',
            label: 'Agents',
            value: `${pct(summary.byPlatform.claude?.delegationRate ?? null, 0)} · ${pct(summary.byPlatform.codex?.autoReviewRate ?? null, 0)}`,
            sub: `Claude${NBSP}delegation · Codex${NBSP}auto-review`,
            tone: 'default',
            help: 'Left: share of Claude sessions that handed work to a subagent (Task/Agent tool). Right: share of Codex threads the guardian auto-reviewer checked. A guardian review is a safety check on an action, not delegated work, so the two are never blended.',
          }
        : {
            key: 'delegation',
            label: 'Delegation',
            value: pct(summary.delegationRate, 0),
            sub: 'of sessions used a subagent',
            tone: 'default',
            help: 'Share of sessions that handed work to a subagent (Task/Agent tool). Indicates how often work is delegated.',
          };

  return [failure, rejection, commit, delegation];
}

export function buildInsightKpis(poll: InsightPoll<InsightsSummary>, platform: Platform): InsightKpisView {
  const base = { errorTitle: 'Could not load the summary rates', errorDescription: SERVER_DOWN };
  if (poll.data) return { ...base, status: 'ready', tiles: kpiTiles(poll.data, platform) };
  return { ...base, status: poll.error && !poll.loading ? 'error' : 'loading', tiles: [] };
}

export function insightsDescription(platform: Platform, days: InsightDays): string {
  return `Behavior analytics for the ${windowLabel(days)}${titleScope(platform)}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  'exit-code': 'Command failed',
  'patch-failed': 'Patch failed',
  'mcp-error': 'MCP error',
  'edit-mismatch': 'Edit mismatch',
  'not-read': 'Not read / stale',
  'file-not-found': 'File not found',
  'too-large': 'Too large',
  'usage-limit': 'Usage limit',
  blocked: 'Blocked',
  'invalid-input': 'Invalid input',
  'api-error': 'API error',
  network: 'Network',
  timeout: 'Timeout',
  other: 'Other',
};

function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key.replace(/-/g, ' ');
}

function rateTone(rate: number): InsightValueTone {
  return rate > 0.1 ? 'danger' : rate > 0.05 ? 'warning' : 'muted';
}

export interface ErrorTrendPointView {
  date: string;
  label: string;
  calls: number;
  errors: number;
}

export interface ErrorBreakdownView extends InsightSectionView {
  categories: InsightRankedRow[];
  tools: InsightRankedRow[];
  toolsNote: string | null;
  trend: ErrorTrendPointView[];
  footnote: string;
}

const ERRORS_FOOTNOTE = 'Failed calls only. Declined or denied calls never ran, and are counted under rejections.';

export function buildErrorBreakdown({ poll, platform, days, ai }: SectionInput<InsightsErrors>): ErrorBreakdownView {
  const multi = platform !== 'claude';
  const view: ErrorBreakdownView = {
    title: 'Tool errors',
    description: `Calls that ran and failed, by category and by tool, ${windowLabel(days)}`,
    help: `Tool calls that ran and failed in this window, by failure category (left) and by tool (right), with failures per day. Each tool's percentage is its own failure rate. Declined or denied calls never ran and are counted under Rejections instead.${
      multi
        ? " Codex failures: a shell command that exited non-zero is 'Command failed', a patch that did not apply 'Patch failed', and an MCP tool's error 'MCP error'."
        : ''
    }`,
    state: pendingState(poll, 'tool errors', 'bars', 8, 520),
    ai,
    categories: [],
    tools: [],
    toolsNote: null,
    trend: [],
    footnote: ERRORS_FOOTNOTE,
  };
  const data = poll.data;
  if (!data) return view;
  if (data.errors === 0) {
    return {
      ...view,
      state: {
        kind: 'empty',
        title: 'No failed tool calls in this window',
        description: 'A call that runs and comes back with an error shows up here.',
      },
    };
  }
  const maxCategory = Math.max(1, ...Object.values(data.categories));
  const maxTool = Math.max(1, ...data.perTool.map((tool) => tool.errors));
  return {
    ...view,
    categories: Object.entries(data.categories)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({
        key: category,
        label: categoryLabel(category),
        title: category,
        percent: share(count, maxCategory),
        value: String(count),
      })),
    tools: data.perTool.map((tool) => ({
      key: tool.name,
      label: toolLabel(tool.name),
      title: tool.name,
      percent: share(tool.errors, maxTool),
      tone: 'danger',
      value: `${compact(tool.errors)} / ${compact(tool.calls)}`,
      valueTone: 'muted',
      secondary: `${(tool.errorRate * 100).toFixed(0)}%`,
      secondaryTone: rateTone(tool.errorRate),
    })),
    toolsNote: data.perToolTotal > data.perTool.length ? `Top ${data.perTool.length} of ${data.perToolTotal}` : null,
    trend: data.trend.map((point) => ({ date: point.date, label: ymdLabel(point.date), calls: point.calls, errors: point.errors })),
  };
}

export interface ToolUsageView extends InsightSectionView {
  rows: InsightRankedRow[];
}

const TOOL_ROWS = 14;

export function buildToolUsage({ poll, platform, days, ai }: SectionInput<ToolsData>): ToolUsageView {
  const data = poll.data;
  const view: ToolUsageView = {
    title: 'Tool usage',
    description:
      data && data.tools.length > 0
        ? `${compact(data.totalCalls)} tool calls in the ${windowLabel(days)}, by tool`
        : `Calls by tool, ${windowLabel(days)}`,
    help:
      platform === 'codex'
        ? 'How many times each tool was invoked in this window, ranked. Codex tool calls are shown under common tool names — a shell command is Bash (Read / Grep / LS when it only reads or searches), a file patch is Edit / Write, and MCP calls read as server · tool.'
        : platform === 'both'
          ? "How many times each tool was invoked in this window, ranked. Codex tool calls are mapped onto the same tool names as Claude's, so the two platforms rank in one list."
          : 'How many times each tool was invoked in this window, ranked. Reflects which tools the work relied on most.',
    state: pendingState(poll, 'tool usage', 'bars', 8),
    ai,
    rows: [],
  };
  if (!data) return view;
  if (data.tools.length === 0) {
    return {
      ...view,
      state: { kind: 'empty', title: 'No tool calls in this window', description: 'Tools the agent runs are counted here.' },
    };
  }
  const top = data.tools.slice(0, TOOL_ROWS);
  const max = top[0]?.count || 1;
  return {
    ...view,
    rows: top.map((tool) => ({
      key: tool.name,
      label: toolLabel(tool.name),
      title: tool.name,
      percent: share(tool.count, max),
      value: compact(tool.count),
    })),
  };
}

export interface McpSideView {
  label: string;
  count: string;
  percent: number;
  share: string;
}

export interface McpServerRowView {
  server: string;
  calls: string;
  errors: string;
  failed: boolean;
}

export interface McpBreakdownView extends InsightSectionView {
  builtin: McpSideView;
  mcp: McpSideView;
  explanation: string;
  servers: McpServerRowView[];
  emptyNote: string | null;
}

function builtInCopy(platform: Platform): { agentNoun: string; examples: string } {
  if (platform === 'codex') return { agentNoun: "Codex's", examples: 'shell commands, file patches, web search…' };
  if (platform === 'both') {
    return { agentNoun: "each agent's", examples: "Claude's Read, Bash, Edit; Codex's shell commands and patches…" };
  }
  return { agentNoun: "Claude's", examples: 'Read, Bash, Edit…' };
}

const EMPTY_SIDE: McpSideView = { label: '', count: '0', percent: 0, share: '0%' };

export function buildMcpBreakdown({ poll, platform, days, ai }: SectionInput<InsightsMcp>): McpBreakdownView {
  const copy = builtInCopy(platform);
  const view: McpBreakdownView = {
    title: 'MCP vs built-in',
    description: `Tool call split, ${windowLabel(days)}`,
    help: `How tool calls split between ${
      platform === 'codex' ? "Codex's" : platform === 'both' ? "each agent's" : "Claude's"
    } built-in tools and tools from connected MCP servers. The per-server table lists call counts and how many failed, one row per MCP server.`,
    state: pendingState(poll, 'the MCP split', 'bars', 4),
    ai,
    builtin: EMPTY_SIDE,
    mcp: EMPTY_SIDE,
    explanation: `Built-in means ${copy.agentNoun} native tools (${copy.examples}). MCP means tools from connected MCP servers. Numbers are tool-call counts in this window; errors are calls that failed (a declined call never reached the server, so it is not one).`,
    servers: [],
    emptyNote: null,
  };
  const data = poll.data;
  if (!data) return view;
  const total = data.builtinCalls + data.mcpCalls;
  if (total === 0 && data.perServer.length === 0) {
    return {
      ...view,
      state: { kind: 'empty', title: 'No tool calls in this window', description: 'Built-in and MCP tool calls are split here once the agent runs some.' },
    };
  }
  const builtinPct = share(data.builtinCalls, total);
  const mcpPct = total > 0 ? 100 - builtinPct : 0;
  return {
    ...view,
    builtin: { label: 'Built-in', count: compact(data.builtinCalls), percent: builtinPct, share: `${builtinPct.toFixed(0)}%` },
    mcp: { label: 'MCP', count: compact(data.mcpCalls), percent: mcpPct, share: `${mcpPct.toFixed(0)}%` },
    servers: data.perServer.map((server) => ({
      server: server.server,
      calls: compact(server.calls),
      errors: server.errors > 0 ? String(server.errors) : '—',
      failed: server.errors > 0,
    })),
    emptyNote: data.perServer.length === 0 && data.mcpCalls === 0 ? 'No MCP tool calls in this window.' : null,
  };
}

export interface RejectionSplitView {
  key: string;
  label: string;
  value: string;
}

export interface RejectionsPanelView extends InsightSectionView {
  split: RejectionSplitView[];
  rows: InsightRankedRow[];
}

const GUARDIAN_DENY_TOOL = 'GuardianReview';

function rejectionToolLabel(name: string): string {
  return name === GUARDIAN_DENY_TOOL ? 'Guardian deny' : toolLabel(name);
}

function emptyRejections(platform: Platform): string {
  if (platform === 'codex') return 'No guardian denials or declined actions in this window';
  if (platform === 'both') return 'No declined prompts or guardian denials in this window';
  return 'No permission rejections in this window';
}

export function buildRejections({ poll, platform, days, ai }: SectionInput<InsightsRejections>): RejectionsPanelView {
  const codex = platform === 'codex';
  const both = platform === 'both';
  const view: RejectionsPanelView = {
    title: codex ? 'Guardian denials and declines' : both ? 'Rejections' : 'Permission rejections',
    description: both ? `Declines and guardian denials by tool, ${windowLabel(days)}` : `By tool, ${windowLabel(days)}`,
    help: codex
      ? "Codex actions that never ran, by tool: denied by the guardian auto-reviewer (its verdict names no tool, so these read 'Guardian deny') or declined by you when Codex asked. High counts flag actions Codex keeps attempting that get stopped."
      : both
        ? 'Calls that never ran, by tool: Claude permission prompts you declined, and Codex actions denied by its guardian auto-reviewer or declined by you.'
        : 'Tool calls you declined when Claude asked for permission, grouped by tool. High counts flag tools Claude reaches for that you often block.',
    state: pendingState(poll, 'rejections', 'bars', 4),
    ai,
    split: [],
    rows: [],
  };
  const data = poll.data;
  if (!data) return view;
  if (data.perTool.length === 0) {
    return {
      ...view,
      state: { kind: 'empty', title: emptyRejections(platform), description: 'A call that is declined or denied before it runs shows up here.' },
    };
  }
  const max = Math.max(1, ...data.perTool.map((tool) => tool.rejections));
  const showSplit = platform !== 'claude' || data.guardianDenials > 0;
  return {
    ...view,
    split: showSplit
      ? [
          {
            key: 'user',
            label: platform === 'claude' ? 'Declined permission prompts' : 'Declined by you',
            value: compact(data.userDeclines),
          },
          { key: 'guardian', label: 'Guardian denials', value: compact(data.guardianDenials) },
        ]
      : [],
    rows: data.perTool.map((tool) => ({
      key: tool.name,
      label: rejectionToolLabel(tool.name),
      title: tool.name,
      percent: share(tool.rejections, max),
      tone: 'warning',
      value: String(tool.rejections),
      valueTone: 'warning',
      secondary: `/ ${compact(tool.calls)}`,
    })),
  };
}

export interface RetryPanelView extends InsightSectionView {
  rate: string;
  applies: boolean;
  rateNote: string;
  facts: InsightFactView[];
  footnote: string | null;
}

const RETRY_FOOTNOTE = 'Wasted tokens are approximated from average tokens per turn times errored edit calls.';
const CODEX_NO_RETRY = "Codex doesn't retry edits — a patch applies, fails or is declined, and the next one is a new change.";
const CLAUDE_ONLY_RETRY = 'Claude edits only — Codex patches never retry.';

export function buildRetries({ poll, platform, days, ai }: SectionInput<InsightsRetries>): RetryPanelView {
  const codex = platform === 'codex';
  const note = platform === 'both' ? CLAUDE_ONLY_RETRY : null;
  const view: RetryPanelView = {
    title: 'Edit retries',
    description: `One-shot analysis, ${windowLabel(days)}`,
    help: codex
      ? 'Codex patches are never retried: each apply_patch either applies, fails or is declined, and the next patch is a new change — so there is no one-shot rate to measure.'
      : `Edit/Write calls that succeeded first try vs those retried after an error, with the estimated tokens and cost wasted on the retries.${
          note ? ` ${note}` : ''
        }`,
    state: null,
    ai: codex ? null : ai,
    rate: 'n/a',
    applies: false,
    rateNote: CODEX_NO_RETRY,
    facts: [],
    footnote: null,
  };
  const data = poll.data;
  if (codex) {
    return {
      ...view,
      footnote: data && data.codexEdits > 0 ? `${compact(data.codexEdits)} edits in this window, none of them retryable.` : null,
    };
  }
  if (!data) return { ...view, state: pendingState(poll, 'edit retries', 'stat') };
  if (data.totalEdits === 0 || data.oneShotRate === null) {
    return {
      ...view,
      state: { kind: 'empty', title: 'No Edit/Write calls ran in this window', description: note ?? 'Edits the agent makes are measured here.' },
    };
  }
  const facts: InsightFactView[] = [
    { key: 'retried', label: 'Retried edits', value: String(data.retried), tone: data.retried > 0 ? 'warning' : 'default', help: null },
    { key: 'tokens', label: 'Wasted tokens', value: compact(data.wastedTokens), tone: 'default', help: null },
  ];
  if (data.wastedCost > 0) {
    facts.push({ key: 'cost', label: 'Est. wasted cost', value: estCost(data.wastedCost), tone: 'warning', help: null });
  }
  return {
    ...view,
    rate: `${(data.oneShotRate * 100).toFixed(1)}%`,
    applies: true,
    rateNote: `of ${compact(data.totalEdits)} Edit/Write calls succeeded first try`,
    facts,
    footnote: note ? `${RETRY_FOOTNOTE} ${note}` : RETRY_FOOTNOTE,
  };
}

export interface LanguageBreakdownView extends InsightSectionView {
  rows: InsightRankedRow[];
  footnote: string;
}

const LANGUAGE_ROWS = 10;
const NO_FILE_EDITS: SectionState = {
  kind: 'empty',
  title: 'No file edits in this window',
  description: 'Files the agent edits or writes are counted here.',
};

export function buildLanguages({ poll, days, ai }: SectionInput<InsightsLanguages[]>): LanguageBreakdownView {
  const view: LanguageBreakdownView = {
    title: 'Languages',
    description: `Edits by file type, ${windowLabel(days)}`,
    help: 'Files touched in this window, bucketed by extension into a language. The bar and the first number count edits and writes; the dimmed number counts reads. Shows what kinds of files the work concentrated on.',
    state: pendingState(poll, 'languages', 'bars', 6),
    ai,
    rows: [],
    footnote: 'Bars and the first number are edits and writes. The dimmed number is reads.',
  };
  const data = poll.data;
  if (!data) return view;
  if (data.length === 0) return { ...view, state: NO_FILE_EDITS };
  const max = Math.max(1, ...data.map((language) => language.edits));
  return {
    ...view,
    rows: data.slice(0, LANGUAGE_ROWS).map((language) => ({
      key: language.language,
      label: language.language,
      percent: share(language.edits, max),
      value: compact(language.edits),
      secondary: language.reads > 0 ? `${compact(language.reads)} ${plural(language.reads, 'read', 'reads')}` : undefined,
    })),
  };
}

export interface BranchRowView {
  key: string;
  label: string;
  value: string;
  note: string;
  percent: number;
}

export interface BranchBreakdownView extends InsightSectionView {
  rows: BranchRowView[];
}

export function buildBranches({ poll, platform, days, ai }: SectionInput<InsightsBranches[]>): BranchBreakdownView {
  const multi = platform !== 'claude';
  const view: BranchBreakdownView = {
    title: 'Branches',
    description: `Effective tokens, est. cost and sessions by git branch, ${windowLabel(days)}`,
    help: `Effective tokens, cost and session count attributed to each git branch (shown as repo / branch). Reflects which branches the most work went into.${
      multi ? " Codex reads the branch and remote from the thread's git metadata; a chat thread that starts outside a repo records none." : ''
    }`,
    state: pendingState(poll, 'branches', 'bars', 5),
    ai,
    rows: [],
  };
  const data = poll.data;
  if (!data) return view;
  if (data.length === 0) {
    return {
      ...view,
      state: {
        kind: 'empty',
        title: 'No branch data in this window',
        description:
          platform === 'codex'
            ? 'Codex chat threads run outside a git repo. A thread started inside one shows up here.'
            : 'Sessions that run inside a git repo show up here.',
      },
    };
  }
  const max = Math.max(1, ...data.map((branch) => branch.effectiveTokens));
  return {
    ...view,
    rows: data.map((branch) => ({
      key: `${branch.repo} ${branch.branch}`,
      label: `${branch.repo} / ${branch.branch}`,
      value: `${compact(branch.effectiveTokens)} tok`,
      note: `Est. cost ${estCost(branch.cost)} · ${branch.sessions} ${plural(branch.sessions, 'session', 'sessions')}`,
      percent: share(branch.effectiveTokens, max),
    })),
  };
}

export interface FileChurnView extends InsightSectionView {
  rows: InsightRankedRow[];
}

const CHURN_ROWS = 12;

export function buildFileChurn({ poll, platform, days, ai }: SectionInput<FileChurnData>): FileChurnView {
  const multi = platform !== 'claude';
  const data = poll.data;
  const view: FileChurnView = {
    title: 'File churn',
    description:
      data && data.files.length > 0
        ? `${compact(data.totalEdits)} edits across ${data.uniqueFiles.toLocaleString('en-US')} ${plural(data.uniqueFiles, 'file', 'files')}, ${windowLabel(days)}`
        : `Most-edited files, ${windowLabel(days)}`,
    help: `Files edited most often in this window. Hover a row for the full path. High churn flags the files the work concentrated on.${
      multi ? ' A file a Codex chat edits outside its own folder is labelled with the project that holds it.' : ''
    }`,
    state: pendingState(poll, 'file churn', 'bars', 6),
    ai,
    rows: [],
  };
  if (!data) return view;
  if (data.files.length === 0) return { ...view, state: NO_FILE_EDITS };
  const top = data.files.slice(0, CHURN_ROWS);
  const max = top[0]?.edits || 1;
  return {
    ...view,
    rows: top.map((file) => ({
      key: file.path,
      label: file.name,
      title: file.path,
      detail: file.projectName || undefined,
      percent: share(file.edits, max),
      value: String(file.edits),
    })),
  };
}

export interface YieldSessionView {
  key: string;
  project: string;
  date: string;
  tokens: string;
}

export interface YieldPanelView extends InsightSectionView {
  stages: InsightRankedRow[];
  stagesNote: string | null;
  tokens: InsightFactView[];
  uncommitted: YieldSessionView[];
  footnote: string;
}

const UNCOMMITTED_ROWS = 5;
const YIELD_FOOTNOTE =
  'Token figures are effective tokens. A session counts as in a repo when a git branch or remote was recorded, or it ran git itself.';

export function buildYield({ poll, days, ai }: SectionInput<InsightsYield>): YieldPanelView {
  const view: YieldPanelView = {
    title: 'Yield',
    description: `From sessions to commits to pull requests, ${windowLabel(days)}`,
    help: 'Of the sessions in this window: how many ran in a git repo (a branch or remote was recorded, or the session ran git), how many committed, and how many of those opened a pull request. Sessions outside any repo sit apart instead of counting as misses. Lists the biggest uncommitted repo sessions.',
    state: pendingState(poll, 'yield', 'bars', 4),
    ai,
    stages: [],
    stagesNote: null,
    tokens: [],
    uncommitted: [],
    footnote: YIELD_FOOTNOTE,
  };
  const data = poll.data;
  if (!data) return view;
  if (data.sessions === 0) {
    return { ...view, state: { kind: 'empty', title: 'No sessions in this window', description: 'Sessions are followed from start to commit to pull request here.' } };
  }
  const top = Math.max(1, data.sessions);
  const prNotes = [
    ...(data.prCount > data.prSessions ? [`${data.prCount} PRs in all.`] : []),
    ...(data.prOnlySessions > 0 ? [`Not counted: ${data.prOnlySessions} that opened a PR without committing.`] : []),
  ];
  const prHint = ['Committed and opened or linked a pull request.', ...prNotes].join(' ');
  const stage = (key: string, label: string, count: number, tone: InsightBarTone, title: string): InsightRankedRow => ({
    key,
    label,
    title,
    percent: share(count, top),
    tone,
    value: String(count),
  });
  return {
    ...view,
    stages: [
      stage('sessions', 'Sessions', data.sessions, 'neutral', 'Every session in the window.'),
      stage('repo', 'In a git repo', data.repoSessions, 'neutral', 'A git branch or remote was recorded, or the session ran git itself.'),
      stage('committed', 'Committed', data.committed, 'success', 'Ran a git commit that succeeded.'),
      stage('pr', 'Opened a PR', data.prSessions, 'success', prHint),
    ],
    stagesNote: prNotes.length > 0 ? `Opened a PR: ${prNotes.join(' ')}` : null,
    tokens: [
      { key: 'committed', label: 'Committed', value: `${compact(data.tokensCommitted)} tok`, tone: 'success', help: null },
      { key: 'uncommitted', label: 'Uncommitted', value: `${compact(data.tokensUncommitted)} tok`, tone: 'default', help: null },
      {
        key: 'norepo',
        label: `No repo, ${data.noRepo} ${plural(data.noRepo, 'session', 'sessions')}`,
        value: `${compact(data.tokensNoRepo)} tok`,
        tone: 'muted',
        help: 'Sessions outside a git repo — excluded from the commit rate.',
      },
    ],
    uncommitted: data.topUncommitted.slice(0, UNCOMMITTED_ROWS).map((session, index) => ({
      key: `${index}-${session.project}-${session.date}`,
      project: session.project,
      date: ymdLabel(session.date),
      tokens: compact(session.effectiveTokens),
    })),
  };
}

export interface SubagentTypeView {
  key: string;
  label: string;
  count: string;
}

export interface SubagentModelView {
  key: string;
  model: string;
  count: string;
}

export interface SubagentStatsPanelView extends InsightSectionView {
  facts: InsightFactView[];
  types: SubagentTypeView[];
  models: SubagentModelView[];
  emptyNote: string | null;
}

function subagentFacts(data: SubagentStats, platform: Platform): InsightFactView[] {
  const fact = (key: string, label: string, value: string, tone: InsightFactTone = 'default'): InsightFactView => ({
    key,
    label,
    value,
    tone,
    help: null,
  });
  const spawns = fact('spawns', 'Subagent spawns', compact(data.delegation.spawns));
  const reviews = fact('reviews', 'Guardian reviews', compact(data.autoReview.reviews));
  if (platform === 'claude') {
    return [spawns, fact('avg', 'Average per delegating session', data.delegation.avgPerSession.toFixed(1))];
  }
  if (platform === 'codex') {
    return [
      reviews,
      fact('denied', 'Denied', compact(data.autoReview.denials), data.autoReview.denials > 0 ? 'warning' : 'default'),
      fact('avg', 'Average per reviewed thread', data.autoReview.avgPerSession.toFixed(1)),
      ...(data.delegation.spawns > 0 ? [fact('other', 'Other subagents', compact(data.delegation.spawns))] : []),
    ];
  }
  return [spawns, reviews];
}

function subagentTypeLabel(type: string): string {
  return type === 'guardian_review' ? 'guardian review' : type;
}

export function buildSubagentStats({ poll, platform, days, ai }: SectionInput<SubagentStats>): SubagentStatsPanelView {
  const codex = platform === 'codex';
  const both = platform === 'both';
  const view: SubagentStatsPanelView = {
    title: codex ? 'Guardian reviews' : both ? 'Subagents and guardian reviews' : 'Subagent stats',
    description: codex
      ? `Auto-review analysis, ${windowLabel(days)}`
      : both
        ? `Counted apart, ${windowLabel(days)}`
        : `Delegation analysis, ${windowLabel(days)}`,
    help: codex
      ? 'Guardian auto-reviews in this window — one per verdict — with how many were denied and the average per reviewed thread; other Codex subagents (/review, spawned threads) are counted apart. Their tokens are folded into the parent thread and priced at zero.'
      : both
        ? 'Claude subagent spawns and Codex guardian reviews, counted apart; the type and model breakdowns list both.'
        : 'Subagent (Task/Agent) spawns in this window: total, average per delegating session, and breakdowns by subagent type and model.',
    state: pendingState(poll, codex ? 'guardian reviews' : 'subagent stats', 'bars', 4),
    ai,
    facts: [],
    types: [],
    models: [],
    emptyNote: null,
  };
  const data = poll.data;
  if (!data) return view;
  const byCount = (a: [string, number], b: [string, number]) => b[1] - a[1];
  const types = Object.entries(data.byType).sort(byCount);
  return {
    ...view,
    facts: subagentFacts(data, platform),
    types: types.map(([type, count]) => ({ key: type, label: subagentTypeLabel(type), count: String(count) })),
    models: Object.entries(data.byModel)
      .sort(byCount)
      .map(([model, count]) => ({ key: model, model, count: String(count) })),
    emptyNote:
      types.length === 0 ? (codex ? 'No guardian reviews or subagents in this window.' : 'No subagents spawned in this window.') : null,
  };
}

export interface CommandUsageView extends InsightSectionView {
  rows: InsightRankedRow[];
}

const COMMAND_ROWS = 12;

export function buildCommandUsage({ poll, platform, days, ai }: SectionInput<CommandUsageData>): CommandUsageView {
  const codex = platform === 'codex';
  const data = poll.data;
  const view: CommandUsageView = {
    title: 'Commands',
    description:
      data && data.commands.length > 0
        ? `${compact(data.slashCommands)} slash commands, ${compact(data.skillSessions)} skill sessions, ${data.uniqueCommands} unique, ${windowLabel(days)}`
        : `Slash commands and skills, ${windowLabel(days)}`,
    help: codex
      ? 'Codex logs no slash commands, and loading a skill is only a file read inside a shell command — there is nothing to count yet.'
      : `Slash commands you typed (Claude Code's prompt history) and the skills that ran (each counted once per session that ran it).${
          platform === 'both' ? ' Claude only — Codex records neither.' : ''
        }`,
    state: pendingState(poll, 'commands', 'bars', 5),
    ai,
    rows: [],
  };
  if (!data) return view;
  if (data.commands.length === 0) {
    return {
      ...view,
      state: codex
        ? { kind: 'empty', title: 'No command data', description: 'Codex logs no slash commands or skill runs.' }
        : {
            kind: 'empty',
            title: 'No slash commands or skills recorded in this window',
            description: 'Commands you type and skills that run are counted here.',
          },
    };
  }
  const top = data.commands.slice(0, COMMAND_ROWS);
  const max = top[0]?.count || 1;
  return {
    ...view,
    rows: top.map((command) => ({
      key: `${command.kind}:${command.command}`,
      label: command.command,
      badge: command.kind === 'skill' ? 'skill' : undefined,
      percent: share(command.count, max),
      value: compact(command.count),
    })),
  };
}

export interface ComplexityTooltipRowView {
  label: string;
  value: string;
}

export interface ComplexityPointView {
  id: string;
  project: string;
  toolCalls: number;
  effectiveTokens: number;
  subagents: number;
  rows: ComplexityTooltipRowView[];
}

export interface ComplexitySeriesView {
  key: string;
  label: string;
  color: string;
  points: ComplexityPointView[];
}

export interface ComplexityScatterView extends InsightSectionView {
  series: ComplexitySeriesView[];
  sizeLabel: string;
  maxSize: number;
  split: boolean;
}

function complexitySizeLabel(platform: Platform): string {
  if (platform === 'codex') return 'Guardian reviews';
  if (platform === 'both') return 'Subagents / reviews';
  return 'Subagents';
}

function complexityPoint(point: ComplexityPoint, sizeLabel: string, split: boolean): ComplexityPointView {
  return {
    id: point.sessionId,
    project: point.project,
    toolCalls: point.toolCalls,
    effectiveTokens: point.effectiveTokens,
    subagents: point.subagents,
    rows: [
      ...(split ? [{ label: 'Platform', value: PLATFORM_NAME[point.platform] }] : []),
      { label: 'Date', value: ymdLabel(point.date) },
      { label: 'Turns', value: point.turns.toLocaleString('en-US') },
      { label: 'Tool calls', value: point.toolCalls.toLocaleString('en-US') },
      { label: 'Effective tokens', value: compact(point.effectiveTokens) },
      { label: sizeLabel, value: point.subagents.toLocaleString('en-US') },
    ],
  };
}

export function buildComplexity({ poll, platform, days, ai }: SectionInput<ComplexityPoint[]>): ComplexityScatterView {
  const codex = platform === 'codex';
  const both = platform === 'both';
  const sizeLabel = complexitySizeLabel(platform);
  const view: ComplexityScatterView = {
    title: 'Session complexity',
    description: `Tool calls against effective tokens, one dot per session; dot size is ${
      codex ? 'guardian reviews' : both ? 'subagents or guardian reviews' : 'subagents'
    }, ${windowLabel(days)}`,
    help: `One dot per session: x = number of tool calls, y = effective tokens, dot size = ${
      codex ? 'guardian auto-reviews (one per verdict)' : both ? 'Claude subagents spawned, or Codex guardian reviews' : 'subagents spawned'
    }. Dots to the upper-right are the heaviest, most complex sessions.`,
    state: pendingState(poll, 'session complexity', 'chart'),
    ai,
    series: [],
    sizeLabel,
    maxSize: 1,
    split: both,
  };
  const data = poll.data;
  if (!data) return view;
  if (data.length === 0) {
    return { ...view, state: { kind: 'empty', title: 'No session data in this window', description: 'Each session becomes one dot here.' } };
  }
  const series: ComplexitySeriesView[] = both
    ? INSIGHT_PLATFORMS.map((name) => ({
        key: name,
        label: PLATFORM_NAME[name],
        color: PLATFORM_COLORS[name],
        points: data.filter((point) => point.platform === name).map((point) => complexityPoint(point, sizeLabel, true)),
      })).filter((entry) => entry.points.length > 0)
    : [
        {
          key: 'all',
          label: 'Sessions',
          color: PLATFORM_COLORS[codex ? 'codex' : 'claude'],
          points: data.map((point) => complexityPoint(point, sizeLabel, false)),
        },
      ];
  return { ...view, series, maxSize: Math.max(1, ...data.map((point) => point.subagents)) };
}

export interface LatencyPlatformRowView {
  key: string;
  label: string;
  color: string;
  turns: string;
  median: string;
  p90: string;
  firstToken: string;
}

export interface LatencyBucketView {
  label: string;
  claude: number;
  codex: number;
  total: number;
}

export interface LatencySeriesView {
  key: 'claude' | 'codex' | 'total';
  label: string;
  color: string;
}

export interface TurnLatencyView extends InsightSectionView {
  facts: InsightFactView[];
  platforms: LatencyPlatformRowView[];
  totals: string;
  histogram: LatencyBucketView[];
  series: LatencySeriesView[];
}

export function formatLatency(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—';
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, '0')}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

function formatActive(ms: number): string {
  const hours = ms / 3_600_000;
  return hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(ms / 60_000)}m`;
}

function latencyFacts(stats: LatencyStats): InsightFactView[] {
  const fact = (key: string, label: string, ms: number | null, help: string): InsightFactView => ({
    key,
    label,
    value: formatLatency(ms),
    tone: 'default',
    help,
  });
  return [
    fact('median', 'Median turn', stats.medianMs, 'Half of all turns finished faster than this.'),
    fact('p90', 'p90 turn', stats.p90Ms, '90% of turns finished faster than this — the long tail.'),
    fact('ttft', 'Median first token', stats.medianTtftMs, 'Time from your prompt to the first reply.'),
    fact('ttft90', 'p90 first token', stats.p90TtftMs, 'The slow end of time-to-first-token.'),
  ];
}

export function buildTurnLatency({ poll, platform, days, ai }: SectionInput<InsightsTurns>): TurnLatencyView {
  const both = platform === 'both';
  const view: TurnLatencyView = {
    title: 'Turn latency',
    description: `Time per turn and to first token, ${windowLabel(days)}`,
    help: `How long a turn took — from your prompt to the agent's last reply or tool call — and how long until its first reply. Median is the typical turn, p90 the slow tail.${
      platform === 'codex'
        ? " Codex records each turn's duration and time to first token itself."
        : both
          ? ' Claude turns are measured from the transcript (capped at 6 h); Codex records its own. Under Both the histogram stacks the two.'
          : ' Claude turns are measured from the transcript, capped at 6 h.'
    }`,
    state: pendingState(poll, 'turn latency', 'chart'),
    ai,
    facts: [],
    platforms: [],
    totals: '',
    histogram: [],
    series: [],
  };
  const data = poll.data;
  if (!data) return view;
  if (data.turns === 0) {
    return { ...view, state: { kind: 'empty', title: 'No completed turns in this window', description: 'A turn is timed once the agent finishes replying.' } };
  }
  const platforms: LatencyPlatformRowView[] = [];
  if (both) {
    for (const name of INSIGHT_PLATFORMS) {
      const stats = data.byPlatform[name];
      if (!stats) continue;
      platforms.push({
        key: name,
        label: PLATFORM_NAME[name],
        color: PLATFORM_COLORS[name],
        turns: compact(stats.turns),
        median: formatLatency(stats.medianMs),
        p90: formatLatency(stats.p90Ms),
        firstToken: formatLatency(stats.medianTtftMs),
      });
    }
  }
  return {
    ...view,
    facts: both ? [] : latencyFacts(data),
    platforms,
    totals: `${compact(data.turns)} ${plural(data.turns, 'turn', 'turns')} · ${formatActive(data.activeMs)} active`,
    histogram: data.histogram.map((bucket) => ({ label: bucket.label, claude: bucket.claude, codex: bucket.codex, total: bucket.total })),
    series: both
      ? [
          { key: 'claude', label: PLATFORM_NAME.claude, color: PLATFORM_COLORS.claude },
          { key: 'codex', label: PLATFORM_NAME.codex, color: PLATFORM_COLORS.codex },
        ]
      : [{ key: 'total', label: 'Turns', color: PLATFORM_COLORS[platform === 'codex' ? 'codex' : 'claude'] }],
  };
}
