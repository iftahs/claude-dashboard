// Approximate per-million-token USD prices, used only for an "equivalent API cost"
// estimate. Subscription usage has no real per-token bill. Keyed by model substring.
interface Price {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const TABLE: Array<[RegExp, Price]> = [
  // Claude Fable
  [/fable/i, { input: 10, output: 50, cacheWrite: 12.50, cacheRead: 1.0 }],
  // Claude Mythos
  [/mythos/i, { input: 10, output: 50, cacheWrite: 12.50, cacheRead: 1.0 }],
  // Claude Opus: 5 and 4.5, 4.6, 4.7, 4.8 are priced at 5 / 25
  [/opus-5|opus-4-[5-8]|opus-4\.[5-8]/i, { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 }],
  // Legacy Claude Opus (3.0, 4.0, 4.1) priced at 15 / 75
  [/opus/i, { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 }],
  // Claude Sonnet (all versions: 3.0, 3.5, 4.5, 4.6, 5) priced at 3 / 15
  [/sonnet/i, { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 }],
  // Claude Haiku 4.5 priced at 1 / 5
  [/haiku-4/i, { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 }],
  // Claude Haiku 3.5 priced at 0.8 / 4
  [/haiku-3-[5-9]|haiku-3\.[5-9]/i, { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 }],
  // Legacy Claude Haiku (3.0) and generic fallback priced at 0.25 / 1.25
  [/haiku/i, { input: 0.25, output: 1.25, cacheWrite: 0.3125, cacheRead: 0.03 }],

  // --- OpenAI Codex (GPT) — the ChatGPT desktop agent's models. Codex reports no
  // cache writes (cache_write_input_tokens is always 0), hence cacheWrite: 0.
  // Most specific first; the generic /^gpt-/ row must stay last of this group.
  [/gpt-5\.6-terra/i, { input: 2, output: 12, cacheWrite: 0, cacheRead: 0.2 }],
  [/gpt-5\.6-luna/i, { input: 0.2, output: 1.2, cacheWrite: 0, cacheRead: 0.02 }],
  [/gpt-5\.6-sol|gpt-5\.5/i, { input: 5, output: 30, cacheWrite: 0, cacheRead: 0.5 }],
  [/gpt-6-astra/i, { input: 10, output: 50, cacheWrite: 0, cacheRead: 1 }],
  // Bundled/unmetered: guardian auto-review, the mini tier and reserve capacity bill nothing.
  [/codex-auto-review|gpt-5\.4-mini|gpt-reserve/i, { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }],
  [/^gpt-/i, { input: 5, output: 30, cacheWrite: 0, cacheRead: 0.5 }],
];

const DEFAULT: Price = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };

function priceFor(model: string): Price {
  for (const [re, p] of TABLE) if (re.test(model)) return p;
  return DEFAULT;
}

/** False for models the table deliberately bills at zero (e.g. codex-auto-review); true otherwise, DEFAULT included. */
export function hasPrice(model: string): boolean {
  const p = priceFor(model);
  return p.input > 0 || p.output > 0 || p.cacheWrite > 0 || p.cacheRead > 0;
}

export function estimateCost(
  model: string,
  t: { inputTokens: number; outputTokens: number; cacheCreateTokens: number; cacheReadTokens: number }
): number {
  const p = priceFor(model);
  return (
    (t.inputTokens * p.input +
      t.outputTokens * p.output +
      t.cacheCreateTokens * p.cacheWrite +
      t.cacheReadTokens * p.cacheRead) /
    1_000_000
  );
}

/**
 * A single blended $/Mtok rate for a model, used ONLY where the input/output split
 * is unavailable (workflow journals store one combined "effective" token count).
 * Approximates a typical agent mix as ~70% input-class / ~30% output tokens — a
 * rough equivalent-API estimate, not a real bill.
 */
export function blendedRatePerMillion(model: string): number {
  const p = priceFor(model);
  return 0.7 * p.input + 0.3 * p.output;
}
