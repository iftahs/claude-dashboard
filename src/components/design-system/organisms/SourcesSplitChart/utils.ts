import type { SourceSplit, UsageSource } from '@/types';

/** Code vs Cowork series colors (kept beside their only consumer). */
export const SOURCE_COLOR: Record<UsageSource, string> = { code: '#d97757', cowork: '#6366f1' };

export function computeSourceSplit(bs: SourceSplit) {
  const codeEff = bs.code.effectiveTokens;
  const coworkEff = bs.cowork.effectiveTokens;
  const total = codeEff + coworkEff;
  const codePct = total > 0 ? (codeEff / total) * 100 : 0;
  return { codeEff, coworkEff, codePct };
}
