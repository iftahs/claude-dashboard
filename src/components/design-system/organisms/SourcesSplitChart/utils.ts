import type { SourceSplit, UsageSource } from '@/types';

/** Per-surface series colors (kept beside their only consumer). */
export const SOURCE_COLOR: Record<UsageSource, string> = { code: '#d97757', cowork: '#6366f1', codex: '#14b8a6' };

export const SOURCE_LABEL: Record<UsageSource, string> = { code: 'Code', cowork: 'Cowork', codex: 'Codex' };

/** Surfaces in display order; a surface with no tokens in the window is dropped. */
export const SOURCE_ORDER: UsageSource[] = ['code', 'cowork', 'codex'];

export interface SourceSegment {
  source: UsageSource;
  effectiveTokens: number;
  cost: number;
  pct: number;
}

export function computeSourceSplit(bs: SourceSplit): SourceSegment[] {
  const total = SOURCE_ORDER.reduce((s, k) => s + bs[k].effectiveTokens, 0);
  return SOURCE_ORDER.filter((k) => bs[k].effectiveTokens > 0).map((k) => ({
    source: k,
    effectiveTokens: bs[k].effectiveTokens,
    cost: bs[k].cost,
    pct: total > 0 ? (bs[k].effectiveTokens / total) * 100 : 0,
  }));
}
