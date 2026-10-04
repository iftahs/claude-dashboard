import type { Platform } from '@/lib/platform';
import type { CodexSplit, SourceSplit, TokenTotals, UsageSource } from '@/types';

export type DailyMetric = 'tokens' | 'cost';

export interface CacheEfficiencyPoint {
  date: string;
  hitRate: number;
  cacheReadTokens: number;
  totalTokens: number;
}

/** One platform's line when the chart compares platforms (the *Both* view). */
export interface CacheSeries {
  key: string;
  label: string;
  color: string;
  points: CacheEfficiencyPoint[];
}

/** One segment of the split bar — a surface (Code / Cowork / Codex) or a Codex thread kind. */
export interface SplitSegment {
  key: string;
  label: string;
  color: string;
  effectiveTokens: number;
  cost: number;
  /** Share of the bar, 0–100. */
  pct: number;
}

/** Per-surface series colors. */
export const SOURCE_COLOR: Record<UsageSource, string> = { code: '#d97757', cowork: '#6366f1', codex: '#14b8a6' };

export const SOURCE_LABEL: Record<UsageSource, string> = { code: 'Code', cowork: 'Cowork', codex: 'Codex' };

/** Surfaces in display order; a surface with no tokens in the window is dropped. */
export const SOURCE_ORDER: UsageSource[] = ['code', 'cowork', 'codex'];

// Guardian reuses its model's palette colour so the entity stays one colour on every chart; validated on #1c1c24 (ΔE 22.2, deutan 12.2, contrast ≥3:1).
export const CODEX_KIND_COLOR = { threads: SOURCE_COLOR.codex, guardian: '#c0a8ff' } as const;
export const CODEX_KIND_LABEL = { threads: 'Threads', guardian: 'Guardian reviews' } as const;

function segments(parts: { key: string; label: string; color: string; t: TokenTotals }[]): SplitSegment[] {
  const total = parts.reduce((s, p) => s + p.t.effectiveTokens, 0);
  return parts
    .filter((p) => p.t.effectiveTokens > 0)
    .map((p) => ({
      key: p.key,
      label: p.label,
      color: p.color,
      effectiveTokens: p.t.effectiveTokens,
      cost: p.t.cost,
      pct: total > 0 ? (p.t.effectiveTokens / total) * 100 : 0,
    }));
}

/** Code / Cowork / Codex — the Claude platform's All filter and the Both platform. */
export function computeSourceSplit(bs: SourceSplit): SplitSegment[] {
  return segments(SOURCE_ORDER.map((k) => ({ key: k, label: SOURCE_LABEL[k], color: SOURCE_COLOR[k], t: bs[k] })));
}

/** Threads / Guardian reviews — the same slot under the Codex platform. */
export function computeCodexSplit(cs: CodexSplit): SplitSegment[] {
  return segments([
    { key: 'threads', label: CODEX_KIND_LABEL.threads, color: CODEX_KIND_COLOR.threads, t: cs.threads },
    { key: 'guardian', label: CODEX_KIND_LABEL.guardian, color: CODEX_KIND_COLOR.guardian, t: cs.guardian },
  ]);
}

/** What the split bar divides, for the platform on screen — never a surface that cannot appear. */
export function sourcesHelp(platform: Platform): string {
  if (platform === 'codex') {
    return 'Split of Codex effective tokens (and equivalent cost) between your own threads and the guardian auto-reviews that check their actions, over the selected window. Guardian reviews run on an internal model that is not priced.';
  }
  if (platform === 'both') {
    return 'Split of effective tokens (and equivalent cost) between Claude Code (CLI), Cowork (desktop local-agent mode) and Codex (ChatGPT desktop) over the selected window.';
  }
  return 'Split of effective tokens (and equivalent cost) between Claude Code (CLI) and Cowork (desktop local-agent mode) over the selected window.';
}
