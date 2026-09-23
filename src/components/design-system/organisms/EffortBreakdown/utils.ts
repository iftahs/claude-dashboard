import type { Platform } from '@/hooks/useSource';
import type { EffortSlice, ReasoningShare } from '@/types';

// Effort is ORDINAL, so one hue in monotone lightness steps (never categorical hues); validated on #1c1c24 (ΔL ≥ 0.06, darkest 2.09:1).
export const EFFORT_COLOR: Record<string, string> = {
  none: '#184f95',
  minimal: '#184f95',
  low: '#256abf',
  medium: '#3987e5',
  high: '#6da7ec',
  xhigh: '#9ec5f4',
  max: '#cde2fb',
};
export const EFFORT_FALLBACK_COLOR = '#6b6b75';

export function effortColor(effort: string): string {
  return EFFORT_COLOR[effort] ?? EFFORT_FALLBACK_COLOR;
}

/** Each slice's share of the slices' effective tokens, 0–100 (0 when all are empty). */
export function slicePcts(slices: EffortSlice[]): number[] {
  const total = slices.reduce((a, s) => a + s.effectiveTokens, 0);
  return slices.map((s) => (total > 0 ? (s.effectiveTokens / total) * 100 : 0));
}

// Partial coverage is said out loud ("41% of 62%") rather than presenting a partial figure as the whole.
export function reasoningLabel(r: ReasoningShare): string {
  if (r.share === null) return 'n/a';
  const pct = `${Math.round(r.share * 100)}%`;
  return r.coverage < 0.95 ? `${pct} of ${Math.round(r.coverage * 100)}%` : pct;
}

export function effortHelp(platform: Platform): string {
  const base =
    'Effective tokens and estimated equivalent cost by the reasoning-effort level each response ran at — all models on top, then each model’s mix. “Reasoning” is the share of output tokens spent reasoning, over the responses that report it';
  if (platform === 'codex') {
    return `${base} (OpenAI’s reasoning output tokens). Codex logs the effort per turn; the guardian auto-review runs at its own level and is not priced.`;
  }
  if (platform === 'both') {
    return `${base} — Claude’s thinking tokens (logged only by newer Claude Code builds; earlier messages count as n/a, never 0%) and OpenAI’s reasoning output tokens. “Not logged” is usage whose log carries no effort level.`;
  }
  return `${base} (the thinking tokens newer Claude Code builds log per response; earlier messages count as n/a, never 0%). “Not logged” is usage from builds that did not record the effort level.`;
}
