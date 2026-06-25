import type { ModelPrice } from './types';

export const PRICING_DATA: ModelPrice[] = [
  { name: 'Claude Fable 5', family: 'fable', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1.0, popular: true },
  { name: 'Claude Mythos 5 (limited availability)', family: 'mythos', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1.0 },
  { name: 'Claude Opus 4.8', family: 'opus-4-8', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5, popular: true },
  { name: 'Claude Opus 4.7', family: 'opus-4-7', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.6', family: 'opus-4-6', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.5', family: 'opus-4-5', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'Claude Opus 4.1 (deprecated)', family: 'opus-4-1', input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { name: 'Claude Opus 4 (deprecated)', family: 'opus-4', input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { name: 'Claude Sonnet 4.6', family: 'sonnet-4-6', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3, popular: true },
  { name: 'Claude Sonnet 4.5', family: 'sonnet-4-5', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'Claude Sonnet 4 (deprecated)', family: 'sonnet-4', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'Claude Haiku 4.5', family: 'haiku-4-5', input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1, popular: true },
  // Legacy models
  { name: 'Claude Sonnet 3.5 (Legacy)', family: 'sonnet-legacy', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'Claude Haiku 3.5 (Legacy)', family: 'haiku-3', input: 0.8, output: 4, cacheWrite: 1.0, cacheRead: 0.08 },
  { name: 'Claude 3 Opus (Legacy)', family: 'opus-legacy', input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { name: 'Claude 3 Haiku (Legacy)', family: 'haiku-legacy', input: 0.25, output: 1.25, cacheWrite: 0.3125, cacheRead: 0.03 },
];

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
