import { dayLabel } from '@/lib/format';
import type { WeeklyData } from '@/types';
import type { CompareRow } from './types';
import type { DailyMetric } from '@/components/design-system/organisms/DailyTrendChart/types';

/**
 * Series colours. Claude takes the dashboard's clay accent (the same hue the
 * Sources split gives Claude Code); Codex takes the teal that split already uses
 * for the Codex surface, so a reader who has seen one chart recognises the other.
 * These are platform colours, deliberately NOT the per-model palette — this chart
 * compares two vendors, not two models.
 */
export const CLAUDE_COLOR = '#d97757';
export const CODEX_COLOR = '#14b8a6';

/**
 * One row per day bucket, joining the two per-platform `/api/usage/weekly`
 * responses on their bucket start. Both are built by the same `buildWeekly` over
 * the same window, so the starts line up; the union + sort is defensive, and a
 * day only one platform has still gets a row (with a zero on the other side).
 */
export function mergePlatformDaily(
  claude: WeeklyData | null,
  codex: WeeklyData | null,
  metric: DailyMetric,
): CompareRow[] {
  const pick = (b: { cost: number; effectiveTokens: number }) =>
    metric === 'cost' ? b.cost : b.effectiveTokens;
  const c = new Map((claude?.buckets ?? []).map((b) => [b.start, pick(b)]));
  const x = new Map((codex?.buckets ?? []).map((b) => [b.start, pick(b)]));
  const starts = [...new Set([...c.keys(), ...x.keys()])].sort((a, b) => a - b);
  return starts.map((start) => ({
    start,
    label: dayLabel(start),
    claude: c.get(start) ?? 0,
    codex: x.get(start) ?? 0,
  }));
}

/**
 * Window totals per platform, plus Codex's share of the two.
 *
 * Read from each response's `totals`, NOT by summing the bars: the buckets are
 * calendar days, so the earliest one reaches back before `rangeFrom` and sums a
 * few percent high. `totals` is the exact window — the same number the Trends
 * stat cards show — and the header line has to agree with those.
 */
export function platformTotals(
  claude: WeeklyData | null,
  codex: WeeklyData | null,
  metric: DailyMetric,
): { claude: number; codex: number; codexSharePct: number | null } {
  const pick = (w: WeeklyData | null) =>
    !w ? 0 : metric === 'cost' ? w.totals.cost : w.totals.effectiveTokens;
  const c = pick(claude);
  const x = pick(codex);
  const sum = c + x;
  return { claude: c, codex: x, codexSharePct: sum > 0 ? Math.round((x / sum) * 100) : null };
}
