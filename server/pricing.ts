// Approximate per-million-token USD prices, used only for an "equivalent API cost"
// estimate. Subscription usage has no real per-token bill. Keyed by model substring.
interface Price {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const TABLE: Array<[RegExp, Price]> = [
  [/opus/i, { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 }],
  [/sonnet/i, { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 }],
  [/haiku/i, { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 }],
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
