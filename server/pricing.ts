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
  // Claude Opus: 4.5, 4.6, 4.7, 4.8 are priced at 5 / 25
  [/opus-4-[5-8]|opus-4\.[5-8]/i, { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 }],
  // Legacy Claude Opus (3.0, 4.0, 4.1) priced at 15 / 75
  [/opus/i, { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 }],
  // Claude Sonnet (all versions: 3.0, 3.5, 4.5, 4.6) priced at 3 / 15
  [/sonnet/i, { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 }],
  // Claude Haiku 4.5 priced at 1 / 5
  [/haiku-4/i, { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 }],
  // Claude Haiku 3.5 priced at 0.8 / 4
  [/haiku-3-[5-9]|haiku-3\.[5-9]/i, { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 }],
  // Legacy Claude Haiku (3.0) and generic fallback priced at 0.25 / 1.25
  [/haiku/i, { input: 0.25, output: 1.25, cacheWrite: 0.3125, cacheRead: 0.03 }],
];

const DEFAULT: Price = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };

function priceFor(model: string): Price {
  for (const [re, p] of TABLE) if (re.test(model)) return p;
  return DEFAULT;
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
