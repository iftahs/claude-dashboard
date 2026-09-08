import type { Platform } from '@/hooks/useSource';
import type { ModelPrice, PriceGroup, PricePlatform } from './types';

/**
 * Reference list prices per 1M tokens. Mirrors the regex table in
 * `server/pricing.ts` — when a rate changes there, change it here too, or the
 * calculator will disagree with every cost figure in the app.
 *
 * The OpenAI rows are the Codex (ChatGPT desktop) models. OpenAI bills no cache
 * *write*, only discounted cached input, so `cacheWrite` is 0 across that group
 * and the column renders as "—".
 */
export const PRICING_DATA: ModelPrice[] = [
  // ── Anthropic ────────────────────────────────────────────────────────────
  { name: 'Claude Fable 5.1', family: 'fable-5-1', platform: 'claude', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 0.25, popular: true },
  { name: 'Claude Fable 5', family: 'fable', platform: 'claude', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1.0 },
  { name: 'Claude Mythos 5 (limited availability)', family: 'mythos', platform: 'claude', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1.0 },
  { name: 'Claude Opus 5', family: 'opus-5', platform: 'claude', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5, popular: true },
  { name: 'Claude Opus 4.8', family: 'opus-4-8', platform: 'claude', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.7', family: 'opus-4-7', platform: 'claude', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.6', family: 'opus-4-6', platform: 'claude', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.5', family: 'opus-4-5', platform: 'claude', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.1 (deprecated)', family: 'opus-4-1', platform: 'claude', input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { name: 'Claude Opus 4 (deprecated)', family: 'opus-4', platform: 'claude', input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { name: 'Claude Sonnet 5', family: 'sonnet-5', platform: 'claude', input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2, popular: true },
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
  // Priced tiers first, most expensive down; gpt-5.6-terra is the desktop
  // default and codex-auto-review the model that actually dominates the charts.
  { name: 'GPT-6 Astra', family: 'gpt-6-astra', platform: 'openai', input: 10, output: 50, cacheWrite: 0, cacheRead: 1.0, popular: true },
  { name: 'GPT-5.6 Sol', family: 'gpt-5-6-sol', platform: 'openai', input: 5, output: 30, cacheWrite: 0, cacheRead: 0.5, popular: true },
  { name: 'GPT-5.6 Terra', family: 'gpt-5-6-terra', platform: 'openai', input: 2, output: 12, cacheWrite: 0, cacheRead: 0.2, popular: true },
  { name: 'GPT-5.6 Luna', family: 'gpt-5-6-luna', platform: 'openai', input: 0.2, output: 1.2, cacheWrite: 0, cacheRead: 0.02, popular: true },
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
  { name: 'GPT-5.5', family: 'gpt-5-5', platform: 'openai', input: 5, output: 30, cacheWrite: 0, cacheRead: 0.5 },
  {
    name: 'GPT-5.4 Mini',
    family: 'gpt-5-4-mini',
    platform: 'openai',
    input: 0,
    output: 0,
    cacheWrite: 0,
    cacheRead: 0,
    note: 'bundled tier — no published rate',
  },
];

const GROUP_LABEL: Record<PricePlatform, string> = {
  claude: 'Claude · Anthropic',
  openai: 'Codex · OpenAI',
};

/**
 * The rate cards to render, in reading order: the selected platform's own first.
 * Codex leads with the GPT rows; Claude and Both lead with Claude. Both shows
 * every group, a single platform only its own.
 */
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

/** The one-line "how the vendor bills" note under the panel heading. */
export function billingBlurb(platform: Platform): string {
  if (platform === 'codex') {
    return 'OpenAI charges by tokens processed. Cached input is discounted ~90%, and there is no separate cache-write charge.';
  }
  if (platform === 'both') {
    return 'Both vendors charge by tokens processed and discount cached input by ~90%. Anthropic also bills a cache write; OpenAI does not.';
  }
  return 'Anthropic charges based on the number of tokens processed. Cache reads are discounted by 90%.';
}

export interface TokenCounts {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/** USD cost of a hypothetical request at the model's per-1M rates. */
export function calcCost(model: ModelPrice, t: TokenCounts): number {
  return (
    (t.input * model.input +
      t.output * model.output +
      t.cacheWrite * model.cacheWrite +
      t.cacheRead * model.cacheRead) /
    1_000_000
  );
}
