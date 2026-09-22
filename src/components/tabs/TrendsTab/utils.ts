import type { Platform } from '@/hooks/useSource';
import type { Bucket, SourceSplit, WeeklyData } from '@/types';

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

/** Trends window presets — the server clamps `days` to MAX_WINDOW_DAYS (365). */
export const TIME_WINDOWS: { days: number; label: string }[] = [
  { days: 7, label: '1w' },
  { days: 14, label: '2w' },
  { days: 30, label: '1m' },
  { days: 60, label: '2m' },
  { days: 90, label: '3m' },
  { days: 180, label: '6m' },
  { days: 365, label: '1y' },
];

/**
 * Sub-label for the comparison period. buildWeekly compares against the preceding
 * N rolling days, so anything past two weeks says so in days — "prev month" would
 * imply a calendar month.
 */
export function prevPeriodLabel(days: number): string {
  if (days === 7) return 'prev week';
  if (days === 14) return 'prev 2 weeks';
  return `prev ${days}d`;
}

/** Max buckets sent to the AI ✨ explainer; the server caps a section at 64 KB. */
const AI_MAX_BUCKETS = 60;

/**
 * The Trends payload for the AI explainer, small enough for long windows: past
 * AI_MAX_BUCKETS days, consecutive daily buckets merge into equal runs (a 1-year
 * window becomes ~52 weekly-ish buckets) and the per-model cost map is dropped —
 * 366 buckets with both maps overflow the 64 KB section limit.
 */
export function aiTrendsPayload(data: WeeklyData | null): (WeeklyData & { daysPerBucket?: number }) | null {
  if (!data || data.buckets.length <= AI_MAX_BUCKETS) return data;
  const per = Math.ceil(data.buckets.length / AI_MAX_BUCKETS);
  const buckets: Bucket[] = [];
  for (let i = 0; i < data.buckets.length; i += per) {
    const run = data.buckets.slice(i, i + per);
    const merged: Bucket = {
      start: run[0].start,
      byModel: {},
      byModelCost: {},
      inputTokens: 0,
      outputTokens: 0,
      cacheCreateTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 0,
      effectiveTokens: 0,
      cost: 0,
    };
    for (const b of run) {
      merged.inputTokens += b.inputTokens;
      merged.outputTokens += b.outputTokens;
      merged.cacheCreateTokens += b.cacheCreateTokens;
      merged.cacheReadTokens += b.cacheReadTokens;
      merged.totalTokens += b.totalTokens;
      merged.effectiveTokens += b.effectiveTokens;
      merged.cost += b.cost;
      for (const [m, v] of Object.entries(b.byModel)) merged.byModel[m] = (merged.byModel[m] ?? 0) + v;
    }
    buckets.push(merged);
  }
  const ce = data.cacheEfficiency ?? [];
  const cePer = Math.max(1, Math.ceil(ce.length / AI_MAX_BUCKETS));
  const cacheEfficiency: NonNullable<WeeklyData['cacheEfficiency']> = [];
  for (let i = 0; i < ce.length; i += cePer) {
    const run = ce.slice(i, i + cePer);
    const cacheReadTokens = run.reduce((a, r) => a + r.cacheReadTokens, 0);
    const totalTokens = run.reduce((a, r) => a + r.totalTokens, 0);
    cacheEfficiency.push({
      date: run[0].date,
      hitRate: totalTokens > 0 ? (cacheReadTokens / totalTokens) * 100 : 0,
      cacheReadTokens,
      totalTokens,
    });
  }
  return { ...data, buckets, cacheEfficiency, daysPerBucket: per };
}
