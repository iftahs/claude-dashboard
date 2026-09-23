import type { Platform } from '@/hooks/useSource';
import type { Bucket, ModelShare, SourceSplit, WeeklyData } from '@/types';

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

// OpenAI publishes no token basis for the Codex limits, so the Codex copy only says what the number is and why it's comparable.
export function effectiveTokensHelp(platform: Platform): string {
  if (platform === 'codex') {
    return 'Uncached input + output tokens. Cached input is excluded — the counterpart of cache reads on Claude — so the figure is comparable across platforms. OpenAI does not publish how tokens weigh against the Codex limits. Compared against the previous period.';
  }
  if (platform === 'both') {
    return 'Input + output + cache-write tokens on both platforms (Codex never reports cache writes). Cache reads and cached input are excluded — cheap context reuse, not new work. Compared against the previous period.';
  }
  return 'Input + output + cache-write tokens — the tokens that count toward rate limits. Cheap cache reads are excluded. Compared against the previous period.';
}

/** Help for the cache-efficiency section — each vendor caches differently. */
export function cacheEfficiencyHelp(platform: Platform): string {
  if (platform === 'codex') {
    return "Share of all tokens served from OpenAI's prompt cache each day (cached input ÷ all tokens). Codex caches automatically and never bills a cache write; higher means more context was reused instead of re-sent.";
  }
  if (platform === 'both') {
    return 'Share of all tokens served from the prompt cache each day (cache reads ÷ all tokens), one line per platform — the two vendors cache differently (Anthropic bills cache writes, OpenAI caches automatically), so a blended rate would describe neither.';
  }
  return 'Share of total tokens served from the prompt cache each day (cache reads ÷ all tokens). Higher means more context was reused cheaply instead of re-sent.';
}

// Reads the same window's byModel (the card's own poll), never the fixed 7-day models poll.
export function topModelByCost(byModel: ModelShare[] | undefined): { model: string; pct: number } | null {
  if (!byModel?.length) return null;
  const total = byModel.reduce((a, m) => a + m.cost, 0);
  if (total <= 0) return null;
  const top = byModel.reduce((best, m) => (m.cost > best.cost ? m : best));
  return { model: top.model, pct: Math.round((top.cost / total) * 100) };
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

// Compares against the preceding N rolling days, so past two weeks it says "Nd" — "prev month" would imply a calendar month.
export function prevPeriodLabel(days: number): string {
  if (days === 7) return 'prev week';
  if (days === 14) return 'prev 2 weeks';
  return `prev ${days}d`;
}

/** Max buckets sent to the AI ✨ explainer; the server caps a section at 64 KB. */
const AI_MAX_BUCKETS = 60;

/** A Trends bucket as the AI explainer sees it: the totals plus ONE per-model map. */
export type AiTrendsBucket = Omit<Bucket, 'byModel' | 'byModelCost'>;

export type AiTrendsPayload = Omit<WeeklyData, 'buckets'> & { buckets: AiTrendsBucket[]; daysPerBucket?: number };

// Merges run from the newest end backward, so only the oldest bucket can be short — the newest always holds a full period.
export function aiTrendsPayload(data: WeeklyData | null): AiTrendsPayload | null {
  if (!data) return null;
  const slim = (b: Bucket): AiTrendsBucket => {
    const { byModel: _t, byModelCost: _c, ...rest } = b;
    return { ...rest, byModelEffective: { ...(b.byModelEffective ?? {}) } };
  };
  if (data.buckets.length <= AI_MAX_BUCKETS) return { ...data, buckets: data.buckets.map(slim) };
  const per = Math.ceil(data.buckets.length / AI_MAX_BUCKETS);
  const buckets: AiTrendsBucket[] = [];
  for (let end = data.buckets.length; end > 0; end -= per) {
    const run = data.buckets.slice(Math.max(0, end - per), end);
    const merged: AiTrendsBucket = {
      start: run[0].start,
      byModelEffective: {},
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
      for (const [m, v] of Object.entries(b.byModelEffective ?? {})) {
        merged.byModelEffective[m] = (merged.byModelEffective[m] ?? 0) + v;
      }
    }
    buckets.unshift(merged);
  }
  const ce = data.cacheEfficiency ?? [];
  const cePer = Math.max(1, Math.ceil(ce.length / AI_MAX_BUCKETS));
  const cacheEfficiency: NonNullable<WeeklyData['cacheEfficiency']> = [];
  for (let end = ce.length; end > 0; end -= cePer) {
    const run = ce.slice(Math.max(0, end - cePer), end);
    const cacheReadTokens = run.reduce((a, r) => a + r.cacheReadTokens, 0);
    const totalTokens = run.reduce((a, r) => a + r.totalTokens, 0);
    cacheEfficiency.unshift({
      date: run[0].date,
      hitRate: totalTokens > 0 ? (cacheReadTokens / totalTokens) * 100 : 0,
      cacheReadTokens,
      totalTokens,
    });
  }
  return { ...data, buckets, cacheEfficiency, daysPerBucket: per };
}
