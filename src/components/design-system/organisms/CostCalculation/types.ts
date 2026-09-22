import type { Platform } from '@/hooks/useSource';

/** Which vendor's rate card a row comes from. Drives grouping, order and labels. */
export type PricePlatform = 'claude' | 'openai';

export interface ModelPrice {
  name: string;
  family: string;
  platform: PricePlatform;
  input: number;
  output: number;
  /** OpenAI has no cache-write charge, so every `openai` row is 0 (rendered as "—"). */
  cacheWrite: number;
  cacheRead: number;
  popular?: boolean;
  /** Shown beside the name for rows whose price needs a caveat (e.g. unbilled models). */
  note?: string;
}

/** One rendered pricing block: a vendor's rows, split into headline and the rest. */
export interface PriceGroup {
  platform: PricePlatform;
  label: string;
  current: ModelPrice[];
  legacy: ModelPrice[];
}

export interface CostCalculationProps {
  /** The header platform switcher's value — decides which rate cards are shown and in what order. */
  platform: Platform;
}
