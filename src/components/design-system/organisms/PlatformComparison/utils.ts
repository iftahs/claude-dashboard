import { compact, shortModel, usd } from '@/lib/format';
import type { ModelShare, SourceSplit, TokenTotals } from '@/types';
import type { ComparisonRow } from './types';

/** Platform series colours — the Code clay and the Codex teal already used by
 *  SourcesSplitChart, so a surface keeps its hue when the split is by platform. */
export const PLATFORM_COLOR = { claude: '#d97757', codex: '#14b8a6' } as const;

const ZERO: TokenTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreateTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 0,
  effectiveTokens: 0,
  cost: 0,
};

function add(a: TokenTotals, b: TokenTotals): TokenTotals {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreateTokens: a.cacheCreateTokens + b.cacheCreateTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    effectiveTokens: a.effectiveTokens + b.effectiveTokens,
    cost: a.cost + b.cost,
  };
}

/** Claude = the two Anthropic surfaces (Claude Code + Cowork); Codex = the OpenAI one. */
export function platformTotals(bs: SourceSplit | null): { claude: TokenTotals; codex: TokenTotals } {
  if (!bs) return { claude: ZERO, codex: ZERO };
  return { claude: add(bs.code, bs.cowork), codex: bs.codex };
}

/** Model families, by name: every OpenAI model this dashboard sees is a gpt or codex build. */
export function isCodexModel(model: string): boolean {
  return /gpt|codex/i.test(model);
}

/** Highest-usage model of one family in the window, by effective tokens. */
export function topModel(byModel: ModelShare[], codex: boolean): ModelShare | null {
  const family = byModel.filter((m) => isCodexModel(m.model) === codex && m.effectiveTokens > 0);
  if (!family.length) return null;
  return family.reduce((best, m) => (m.effectiveTokens > best.effectiveTokens ? m : best));
}

/** The comparison rows for one platform — same order and units on both sides. */
export function comparisonRows(t: TokenTotals, weekDays: number, top: ModelShare | null): ComparisonRow[] {
  return [
    {
      key: 'effective',
      label: 'Effective tokens',
      value: compact(t.effectiveTokens),
      help: 'Input + output + cache writes — what counts against the rate limits. Cheap cache reads are excluded.',
    },
    { key: 'total', label: 'Total tokens', value: compact(t.totalTokens), help: 'Everything, cache reads included.' },
    {
      key: 'cost',
      label: 'Est. cost',
      value: usd(t.cost),
      help: 'Equivalent list API price for the same tokens. A subscription has no per-token bill — this is a comparison figure, not a charge.',
    },
    { key: 'per-day', label: 'Cost / day', value: usd(weekDays > 0 ? t.cost / weekDays : 0) },
    {
      key: 'model',
      label: 'Top model',
      value: top ? shortModel(top.model) : '—',
      help: top ? `${compact(top.effectiveTokens)} effective tokens in this window` : undefined,
    },
  ];
}

/** Share of effective tokens, rounded for display (0 when neither platform has any). */
export function shareSplit(claude: TokenTotals, codex: TokenTotals): { claude: number; codex: number } {
  const total = claude.effectiveTokens + codex.effectiveTokens;
  if (total <= 0) return { claude: 0, codex: 0 };
  const c = Math.round((claude.effectiveTokens / total) * 100);
  return { claude: c, codex: 100 - c };
}
