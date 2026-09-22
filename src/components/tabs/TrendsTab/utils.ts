import type { Platform } from '@/hooks/useSource';
import type { SourceSplit } from '@/types';

export { PLATFORM_NOUN } from '@/lib/platform';

/**
 * The "what is this cost, really" sentence behind the est.-cost card. Every
 * platform bills by subscription, so the figure is always a list-price
 * equivalent — only the vendor whose rate card it comes from changes.
 */
export function costBasisHelp(platform: Platform, litellmAvailable: boolean): string {
  if (platform === 'claude' && litellmAvailable) {
    return "Estimated from your local logs at Anthropic's public API rates — a reference figure. Compare it with “Actual billed” (your gateway's real charge): the two differ because the gateway also bills failed/retried requests, uses calendar-day windows, and reflects a more up-to-date snapshot.";
  }
  if (platform === 'codex') {
    return "What this usage would cost at OpenAI's pay-as-you-go API rates. Your ChatGPT subscription has no per-token bill — this is a reference figure only. The internal guardian review model is unpriced.";
  }
  if (platform === 'both') {
    return "What this usage would cost at Anthropic's and OpenAI's pay-as-you-go API rates, added together. Neither subscription has a per-token bill — this is a reference figure only.";
  }
  return "What this usage would cost at Anthropic's pay-as-you-go API rates. Your subscription has no per-token bill — this is a reference figure only.";
}

/**
 * "Claude $12.40 · Codex $3.10" for a stat card's sub-line under the *Both*
 * platform. Claude is Code + Cowork (the two Anthropic surfaces); Codex is the
 * ChatGPT desktop agent. `scale` re-expresses the window total in the card's own
 * unit — 1/weekDays for a per-day average, daysInMonth/weekDays for the month
 * projection. Returns null when there is nothing to split.
 */
export function platformSplitLabel(
  bySource: SourceSplit | undefined,
  field: 'cost' | 'effectiveTokens',
  fmt: (n: number) => string,
  scale = 1,
): string | null {
  if (!bySource) return null;
  const claude = (bySource.code[field] + bySource.cowork[field]) * scale;
  const codex = bySource.codex[field] * scale;
  if (claude === 0 && codex === 0) return null;
  return `Claude ${fmt(claude)} · Codex ${fmt(codex)}`;
}
