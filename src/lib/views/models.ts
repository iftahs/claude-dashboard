import { compact, effortLabel, shortModel, usd } from '@/lib/format';
import { modelColor } from '@/lib/palette';
import { titleScope } from '@/lib/platform';
import type { Platform } from '@/lib/platform';
import type { SectionAi, SectionState } from '@/lib/section';
import type { EffortData, EffortSlice, ModelsData, ReasoningShare } from '@/types';

export function effortHelp(platform: Platform): string {
  const base =
    'Effective tokens and estimated equivalent cost by the reasoning-effort level each response ran at — all models on top, then each model’s mix. “Reasoning” is the share of output tokens spent reasoning, over the responses that report it';
  if (platform === 'codex') {
    return `${base} (OpenAI’s reasoning output tokens). Codex logs the effort per turn; the guardian auto-review runs at its own level and is not priced.`;
  }
  if (platform === 'both') {
    return `${base} — Claude’s thinking tokens (logged only by newer Claude Code builds; earlier messages count as n/a, never 0%) and OpenAI’s reasoning output tokens. “Not logged” is usage whose log carries no effort level.`;
  }
  return `${base} (the thinking tokens newer Claude Code builds log per response; earlier messages count as n/a, never 0%). “Not logged” is usage from builds that did not record the effort level.`;
}

export interface ModelsPoll<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const SERVER_DOWN = 'The dashboard server did not answer. It keeps retrying.';

function estCost(amount: number): string {
  return amount === 0 ? '~$0' : `~${usd(amount)}`;
}
const SYNTHETIC_MODEL = '<synthetic>';
const WINDOW = 'last 7 days';
// Body height of the two model cards with a typical handful of models, so the cost card under them stays put while they load.
const CARD_BODY_HEIGHT = 300;

export const MODELS_DESCRIPTION: Record<Platform, string> = {
  claude: 'Which models your usage leans on, how hard they reason and what they cost at list price.',
  codex: 'Which Codex models your usage leans on, how hard they reason and what they cost at list price.',
  both: 'Which Claude and Codex models your usage leans on, how hard they reason and what they cost at list price.',
};

export interface ModelSliceView {
  id: string;
  label: string;
  color: string;
  value: number;
  tokens: string;
  total: string;
  share: string;
}

export interface ModelEfficiencyRowView {
  key: string;
  label: string;
  title: string;
  color: string;
  percent: number;
  value: string;
}

export interface ModelBreakdownView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  ai: SectionAi | null;
  slices: ModelSliceView[];
  efficiency: ModelEfficiencyRowView[];
}

interface ModelBreakdownInput {
  poll: ModelsPoll<ModelsData>;
  platform: Platform;
  ai: SectionAi | null;
}

export function buildModelBreakdown({ poll, platform, ai }: ModelBreakdownInput): ModelBreakdownView {
  const view: ModelBreakdownView = {
    title: `Model breakdown${titleScope(platform)}`,
    description: `Share of effective tokens by model, ${WINDOW}`,
    help:
      platform === 'claude'
        ? "Share of effective tokens by model over the last 7 days, with each model's cost per 1M effective tokens. Shows which models your usage leans on."
        : `Share of effective tokens by model over the last 7 days, with each model's cost per 1M effective tokens. Covers ${
            platform === 'codex' ? 'the Codex (GPT) models' : 'both the Claude and the Codex (GPT) models'
          }; Codex costs are OpenAI list-price estimates and the internal guardian review model is unpriced.`,
    state: null,
    ai,
    slices: [],
    efficiency: [],
  };
  const data = poll.data;
  if (!data) {
    const state: SectionState =
      poll.error && !poll.loading
        ? { kind: 'error', title: 'Could not load the model breakdown', description: SERVER_DOWN }
        : { kind: 'loading', skeleton: 'bars', rows: 5, height: CARD_BODY_HEIGHT };
    return { ...view, state };
  }
  const used = data.models
    .filter((model) => model.effectiveTokens > 0 && model.model !== SYNTHETIC_MODEL)
    .sort((a, b) => b.effectiveTokens - a.effectiveTokens);
  if (used.length === 0) {
    return { ...view, state: { kind: 'empty', title: 'No usage yet', description: 'Models show up here once they have used tokens in the last 7 days.' } };
  }
  const total = used.reduce((sum, model) => sum + model.effectiveTokens, 0);
  const priced = used
    .filter((model) => model.cost > 0)
    .map((model) => ({ model: model.model, costPer1M: (model.cost / model.effectiveTokens) * 1_000_000 }))
    .sort((a, b) => a.costPer1M - b.costPer1M);
  const maxCost = Math.max(...priced.map((entry) => entry.costPer1M), 1);
  return {
    ...view,
    slices: used.map((model) => ({
      id: model.model,
      label: shortModel(model.model),
      color: modelColor(model.model),
      value: model.effectiveTokens,
      tokens: compact(model.effectiveTokens),
      total: compact(model.totalTokens),
      share: `${((model.effectiveTokens / total) * 100).toFixed(0)}%`,
    })),
    efficiency: priced.map((entry) => ({
      key: entry.model,
      label: shortModel(entry.model),
      title: entry.model,
      color: modelColor(entry.model),
      percent: (entry.costPer1M / maxCost) * 100,
      value: `${estCost(entry.costPer1M)} / 1M`,
    })),
  };
}

export interface EffortSliceView {
  key: string;
  label: string;
  color: string;
  percent: number;
  detail: string;
}

export interface EffortModelRowView {
  key: string;
  model: string;
  label: string;
  color: string;
  summary: string;
  cost: string;
  reasoning: string;
  slices: EffortSliceView[];
}

export interface EffortBreakdownView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  reasoning: string;
  slices: EffortSliceView[];
  models: EffortModelRowView[];
}

interface EffortBreakdownInput {
  poll: ModelsPoll<EffortData>;
  platform: Platform;
}

// Effort is ordinal: one hue, stepped from info toward the card (low) and toward the text colour (high); the faintest step keeps 3:1 on the card in both themes.
const INFO = 'rgb(var(--info))';
const towardCard = (percent: number) => `color-mix(in srgb, ${INFO} ${percent}%, rgb(var(--surface)))`;
const towardText = (percent: number) => `color-mix(in srgb, ${INFO} ${percent}%, rgb(var(--fg)))`;
const EFFORT_COLOR: Record<string, string> = {
  none: towardCard(75),
  minimal: towardCard(75),
  low: towardCard(88),
  medium: INFO,
  high: towardText(78),
  xhigh: towardText(56),
  max: towardText(34),
};
const EFFORT_FALLBACK_COLOR = 'rgb(var(--fg-subtle))';

function effortColor(effort: string): string {
  return EFFORT_COLOR[effort] ?? EFFORT_FALLBACK_COLOR;
}

function reasoningLabel(reasoning: ReasoningShare): string {
  if (reasoning.share === null) return 'n/a';
  const percent = `${Math.round(reasoning.share * 100)}%`;
  return reasoning.coverage < 0.95 ? `${percent} of ${Math.round(reasoning.coverage * 100)}%` : percent;
}

function effortSlices(slices: EffortSlice[]): EffortSliceView[] {
  const total = slices.reduce((sum, slice) => sum + slice.effectiveTokens, 0);
  return slices.map((slice) => {
    const percent = total > 0 ? (slice.effectiveTokens / total) * 100 : 0;
    return {
      key: slice.effort,
      label: effortLabel(slice.effort),
      color: effortColor(slice.effort),
      percent,
      detail: `${compact(slice.effectiveTokens)} · ${percent.toFixed(0)}%${slice.cost > 0 ? ` · ${estCost(slice.cost)}` : ''}`,
    };
  });
}

export function buildEffortBreakdown({ poll, platform }: EffortBreakdownInput): EffortBreakdownView {
  const view: EffortBreakdownView = {
    title: `Reasoning effort${titleScope(platform)}`,
    description: `Effective tokens by effort level, ${WINDOW}`,
    help: effortHelp(platform),
    state: null,
    reasoning: 'n/a',
    slices: [],
    models: [],
  };
  const data = poll.data;
  if (!data) {
    const state: SectionState =
      poll.error && !poll.loading
        ? { kind: 'error', title: 'Could not load reasoning effort', description: SERVER_DOWN }
        : { kind: 'loading', skeleton: 'bars', rows: 5, height: CARD_BODY_HEIGHT };
    return { ...view, state };
  }
  if (data.models.length === 0) {
    return {
      ...view,
      state: { kind: 'empty', title: 'No usage in this window', description: 'Effort levels show up here once a model has used tokens in the last 7 days.' },
    };
  }
  return {
    ...view,
    reasoning: reasoningLabel(data.reasoning),
    slices: effortSlices(data.efforts),
    models: data.models.map((model) => ({
      key: model.model,
      model: model.model,
      label: shortModel(model.model),
      color: modelColor(model.model),
      summary: `${shortModel(model.model)} · ${compact(model.effectiveTokens)} effective`,
      cost: model.cost > 0 ? estCost(model.cost) : '—',
      reasoning: reasoningLabel(model.reasoning),
      slices: effortSlices(model.efforts),
    })),
  };
}

export type PricePlatform = 'claude' | 'openai';

export interface ModelPrice {
  name: string;
  family: string;
  platform: PricePlatform;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  popular?: boolean;
  note?: string;
}

export interface PriceGroup {
  platform: PricePlatform;
  label: string;
  current: ModelPrice[];
  legacy: ModelPrice[];
}

// Mirrors the regex table in server/pricing.ts: change a rate there and here together, or the calculator disagrees with every cost figure.
export const PRICING_DATA: ModelPrice[] = [
  // ── Anthropic ────────────────────────────────────────────────────────────
  { name: 'Claude Fable 5.1', family: 'fable-5-1', platform: 'claude', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 0.25, popular: true },
  { name: 'Claude Fable 5', family: 'fable', platform: 'claude', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1.0 },
  { name: 'Claude Mythos 5.1 (limited availability)', family: 'mythos-5-1', platform: 'claude', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 0.25 },
  { name: 'Claude Mythos 5 (limited availability)', family: 'mythos', platform: 'claude', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1.0 },
  { name: 'Claude Opus 5.5', family: 'opus-5-5', platform: 'claude', input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2, popular: true },
  { name: 'Claude Opus 5', family: 'opus-5', platform: 'claude', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.8', family: 'opus-4-8', platform: 'claude', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.7', family: 'opus-4-7', platform: 'claude', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.6', family: 'opus-4-6', platform: 'claude', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.5', family: 'opus-4-5', platform: 'claude', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.1 (deprecated)', family: 'opus-4-1', platform: 'claude', input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { name: 'Claude Opus 4 (deprecated)', family: 'opus-4', platform: 'claude', input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { name: 'Claude Sonnet 5.5', family: 'sonnet-5-5', platform: 'claude', input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2, popular: true },
  { name: 'Claude Sonnet 5', family: 'sonnet-5', platform: 'claude', input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  { name: 'Claude Sonnet 4.6', family: 'sonnet-4-6', platform: 'claude', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'Claude Sonnet 4.5', family: 'sonnet-4-5', platform: 'claude', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'Claude Sonnet 4 (deprecated)', family: 'sonnet-4', platform: 'claude', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'Claude Haiku 4.5', family: 'haiku-4-5', platform: 'claude', input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1, popular: true },
  // Legacy Claude models
  { name: 'Claude Sonnet 3.5 (Legacy)', family: 'sonnet-legacy', platform: 'claude', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'Claude Haiku 3.5 (Legacy)', family: 'haiku-3', platform: 'claude', input: 0.8, output: 4, cacheWrite: 1.0, cacheRead: 0.08 },
  { name: 'Claude 3 Opus (Legacy)', family: 'opus-legacy', platform: 'claude', input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { name: 'Claude 3 Haiku (Legacy)', family: 'haiku-legacy', platform: 'claude', input: 0.25, output: 1.25, cacheWrite: 0.3125, cacheRead: 0.03 },

  // ── OpenAI (Codex, via the ChatGPT desktop app) ──────────────────────────
  // Current tiers first, most expensive down — superseded tiers sit behind "Show other".
  { name: 'GPT-6 Astra', family: 'gpt-6-astra', platform: 'openai', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1.0, popular: true },
  { name: 'GPT-5.6 Terra', family: 'gpt-5-6-terra', platform: 'openai', input: 2, output: 12, cacheWrite: 2.5, cacheRead: 0.2, popular: true },
  { name: 'GPT-6 Sol', family: 'gpt-6-sol', platform: 'openai', input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2, popular: true },
  { name: 'GPT-6 Luna', family: 'gpt-6-luna', platform: 'openai', input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01, popular: true },
  {
    name: 'codex-auto-review',
    family: 'codex-auto-review',
    platform: 'openai',
    input: 0,
    output: 0,
    cacheWrite: 0,
    cacheRead: 0,
    popular: true,
    note: 'internal review model — not billed',
  },
  { name: 'GPT-5.6 Sol', family: 'gpt-5-6-sol', platform: 'openai', input: 4, output: 20, cacheWrite: 5, cacheRead: 0.4 },
  { name: 'GPT-5.6 Luna', family: 'gpt-5-6-luna', platform: 'openai', input: 0.2, output: 1.2, cacheWrite: 0.25, cacheRead: 0.02 },
  { name: 'GPT-5.5', family: 'gpt-5-5', platform: 'openai', input: 5, output: 30, cacheWrite: 0, cacheRead: 0.5 },
  { name: 'GPT-5.4 Mini', family: 'gpt-5-4-mini', platform: 'openai', input: 0.75, output: 4.5, cacheWrite: 0, cacheRead: 0.075 },
  { name: 'GPT-5.3 Codex', family: 'gpt-5-3-codex', platform: 'openai', input: 1.75, output: 14, cacheWrite: 0, cacheRead: 0.175 },
  {
    name: 'gpt-reserve',
    family: 'gpt-reserve',
    platform: 'openai',
    input: 0,
    output: 0,
    cacheWrite: 0,
    cacheRead: 0,
    note: 'reserve capacity — not billed',
  },
];

const GROUP_LABEL: Record<PricePlatform, string> = {
  claude: 'Claude · Anthropic',
  openai: 'Codex · OpenAI',
};

export function priceGroups(platform: Platform): PriceGroup[] {
  const order: PricePlatform[] =
    platform === 'codex' ? ['openai'] : platform === 'claude' ? ['claude'] : ['claude', 'openai'];
  return order.map((p) => {
    const rows = PRICING_DATA.filter((m) => m.platform === p);
    return {
      platform: p,
      label: GROUP_LABEL[p],
      current: rows.filter((m) => m.popular),
      legacy: rows.filter((m) => !m.popular),
    };
  });
}

export function billingBlurb(platform: Platform): string {
  if (platform === 'codex') {
    return 'OpenAI charges by tokens processed. Cached input is discounted ~90%. GPT-5.6 and GPT-6 list a cache-write rate, but Codex never reports cache writes.';
  }
  if (platform === 'both') {
    return 'Both vendors charge by tokens processed and discount cached input (usually by ~90%). Anthropic bills cache writes; OpenAI lists them for GPT-5.6 and GPT-6, but Codex never reports any.';
  }
  return 'Anthropic charges based on the number of tokens processed. Cache reads are discounted by 90% (95% on Opus 5.5, 97.5% on Fable 5.1 and Mythos 5.1).';
}

export interface TokenCounts {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export function calcCost(model: ModelPrice, t: TokenCounts): number {
  return (
    (t.input * model.input +
      t.output * model.output +
      t.cacheWrite * model.cacheWrite +
      t.cacheRead * model.cacheRead) /
    1_000_000
  );
}

export type TokenField = keyof TokenCounts;
export type TokenInputs = Record<TokenField, string>;
export type ExpandedGroups = Partial<Record<PricePlatform, boolean>>;

export const DEFAULT_TOKEN_INPUTS: TokenInputs = {
  input: '100000',
  output: '20000',
  cacheWrite: '50000',
  cacheRead: '200000',
};

const TOKEN_DIGITS = 10;

export function sanitizeTokenInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, TOKEN_DIGITS);
}

function tokenCount(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function selectedPrice(groups: PriceGroup[], name: string | null): ModelPrice {
  for (const group of groups) {
    const match = [...group.current, ...group.legacy].find((model) => model.name === name);
    if (match) return match;
  }
  return groups[0].current[0];
}

export function isHeadlinePrice(model: ModelPrice): boolean {
  return Boolean(model.popular);
}

export interface PriceRowView {
  key: string;
  name: string;
  note: string | null;
  input: string;
  output: string;
  cacheWrite: string;
  cacheRead: string;
  selected: boolean;
}

export interface PriceGroupView {
  key: PricePlatform;
  label: string;
  caption: string;
  rows: PriceRowView[];
  toggleLabel: string | null;
  expanded: boolean;
}

export interface PriceModelOption {
  value: string;
  label: string;
}

export interface CostFieldView {
  key: TokenField;
  label: string;
  value: string;
  helper: string;
}

export interface CostCalculationView {
  title: string;
  description: string;
  help: string;
  groups: PriceGroupView[];
  cachingTitle: string;
  cachingNote: string;
  modelOptions: PriceModelOption[];
  selected: string;
  fields: CostFieldView[];
  cost: string;
  formula: string[];
  formulaTotal: string;
  modelNote: string | null;
}

interface CostCalculationInput {
  platform: Platform;
  groups: PriceGroup[];
  selected: ModelPrice;
  expanded: ExpandedGroups;
  inputs: TokenInputs;
}

const PRICING_HELP =
  "Reference pay-as-you-go API prices (per 1M tokens, by model). Your subscription has no per-token bill — these power the 'estimated equivalent cost' figures. Use the calculator to price a hypothetical request; cache reads are billed at a fraction of input (usually 10%).";
const CACHING_NOTE =
  'Cache reads usually cost 10% of the standard input price (5% on Opus 5.5, 2.5% on Fable 5.1 and Mythos 5.1). Designing your prompts to reuse systemic instructions, codebase maps, or tool schemas leverages this pricing to achieve massive savings.';
const CACHING_NOTE_OPENAI =
  ' OpenAI applies the same discount to cached input. GPT-5.6 and GPT-6 list a cache-write rate, but Codex never reports cache writes, so it never changes an estimate; older GPT models have no write rate and read “—”.';
const FIELD_LABEL: Record<TokenField, string> = {
  input: 'Input tokens',
  output: 'Output tokens',
  cacheWrite: 'Cache write tokens',
  cacheRead: 'Cache read tokens',
};
const FIELD_ORDER: readonly TokenField[] = ['input', 'output', 'cacheWrite', 'cacheRead'];

function rate(model: ModelPrice, field: TokenField): string {
  if (field === 'cacheWrite' && model.platform === 'openai' && model.cacheWrite === 0) return '—';
  const v = model[field];
  if (v === 0) return '$0';
  const cents = v * 100;
  return `$${Math.abs(cents - Math.round(cents)) < 1e-9 ? v.toFixed(2) : String(+v.toFixed(4))}`;
}

function priceRow(model: ModelPrice, selected: ModelPrice): PriceRowView {
  return {
    key: model.name,
    name: model.name,
    note: model.note ?? null,
    input: rate(model, 'input'),
    output: rate(model, 'output'),
    cacheWrite: rate(model, 'cacheWrite'),
    cacheRead: rate(model, 'cacheRead'),
    selected: model.name === selected.name,
  };
}

export function buildCostCalculation({ platform, groups, selected, expanded, inputs }: CostCalculationInput): CostCalculationView {
  const counts: TokenCounts = {
    input: tokenCount(inputs.input),
    output: tokenCount(inputs.output),
    cacheWrite: tokenCount(inputs.cacheWrite),
    cacheRead: tokenCount(inputs.cacheRead),
  };
  const noCacheWrite = selected.platform === 'openai' && selected.cacheWrite === 0;
  const cost = estCost(calcCost(selected, counts));
  return {
    title: 'Cost calculation explained',
    description: billingBlurb(platform),
    help: PRICING_HELP,
    groups: groups.map((group) => {
      const open = Boolean(expanded[group.platform]);
      return {
        key: group.platform,
        label: group.label,
        caption: `${group.label} list prices per 1M tokens`,
        rows: [...group.current, ...(open ? group.legacy : [])].map((model) => priceRow(model, selected)),
        toggleLabel: group.legacy.length > 0 ? (open ? 'Hide other models' : `Show other models (${group.legacy.length})`) : null,
        expanded: open,
      };
    }),
    cachingTitle: 'Prompt caching benefit',
    cachingNote: platform === 'claude' ? CACHING_NOTE : `${CACHING_NOTE}${CACHING_NOTE_OPENAI}`,
    modelOptions: groups.flatMap((group) => [...group.current, ...group.legacy].map((model) => ({ value: model.name, label: model.name }))),
    selected: selected.name,
    fields: FIELD_ORDER.map((field) => ({
      key: field,
      label: FIELD_LABEL[field],
      value: inputs[field],
      helper: `${counts[field].toLocaleString('en-US')} tokens${field === 'cacheWrite' && noCacheWrite ? ', not charged for this model' : ''}`,
    })),
    cost,
    formula: [
      `(${compact(counts.input)} × $${selected.input}/M) + (${compact(counts.output)} × $${selected.output}/M) +`,
      `(${compact(counts.cacheWrite)} × $${selected.cacheWrite}/M) + (${compact(counts.cacheRead)} × $${selected.cacheRead}/M)`,
    ],
    formulaTotal: `= ${cost}`,
    modelNote: selected.note ? `${selected.name}: ${selected.note}.` : null,
  };
}
