import type { WeekStart } from '@/lib/week';
import type { DailyActivity } from '@/types';

export const WEEKS = 18; // ~4 months
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LABELED_DOW = new Set([1, 3, 5]); // label Mon/Wed/Fri rows, blank the rest

/** Row labels (top→bottom) for the heatmap, sparse, honoring the week start. */
export function weekdayLabels(weekStart: WeekStart): string[] {
  const startDow = weekStart === 'sunday' ? 0 : 1;
  return Array.from({ length: 7 }, (_, i) => {
    const dow = (startDow + i) % 7;
    return LABELED_DOW.has(dow) ? SHORT_DAYS[dow] : '';
  });
}

export function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Heaviest day in the rendered range — null when nothing was used, so the caller can
 * omit the sentence rather than claim a peak of zero. Runs over the padded grid cells,
 * not the raw response, so the claim always matches a square the user can actually see.
 */
export function peakDay(cells: DailyActivity[]): DailyActivity | null {
  let best: DailyActivity | null = null;
  for (const c of cells) {
    if (c.effectiveTokens > 0 && (best === null || c.effectiveTokens > best.effectiveTokens)) best = c;
  }
  return best;
}

/** "Wed, 18 Jun 2026" — day-first and spelled, so it can't be misread as 06/18. */
export function fullDate(key: string): string {
  return new Date(key + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function color(tokens: number, max: number): string {
  if (tokens === 0) return '#1b1b22';
  const t = Math.min(1, Math.sqrt(tokens / Math.max(1, max)));
  const a = 0.2 + t * 0.8;
  return `rgba(217, 119, 87, ${a.toFixed(2)})`;
}
