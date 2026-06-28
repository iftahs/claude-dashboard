/** First-day-of-week preference, resolved to a concrete day (never 'auto'). */
export type WeekStart = 'sunday' | 'monday';

/**
 * Best-effort first day of the week from the browser locale via `Intl.Locale`
 * week info (`firstDay`: 1=Mon … 7=Sun). Falls back to Monday when the API is
 * unavailable, which preserves the dashboard's previous fixed behaviour.
 */
export function localeDefaultWeekStart(): WeekStart {
  try {
    const lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    // `weekInfo` (property) and `getWeekInfo()` (method) both ship across engines.
    const loc = new Intl.Locale(lang) as Intl.Locale & {
      weekInfo?: { firstDay: number };
      getWeekInfo?: () => { firstDay: number };
    };
    const info = typeof loc.getWeekInfo === 'function' ? loc.getWeekInfo() : loc.weekInfo;
    return info?.firstDay === 7 ? 'sunday' : 'monday';
  } catch {
    return 'monday';
  }
}

/** Day-of-week index (0=Sun, 1=Mon) the week begins on. */
function startDow(ws: WeekStart): number {
  return ws === 'sunday' ? 0 : 1;
}

/** Local-midnight timestamp of today. */
export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local-midnight timestamp of tomorrow (daily reset countdown). */
export function nextDayReset(now: number): number {
  const d = new Date(startOfDay(now));
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** Local-midnight timestamp of the current week's first day. */
export function startOfWeek(now: number, ws: WeekStart): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() - startDow(ws) + 7) % 7;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

/** Local-midnight timestamp of the next week's first day (reset countdown). */
export function nextWeekReset(now: number, ws: WeekStart): number {
  const d = new Date(startOfWeek(now, ws));
  d.setDate(d.getDate() + 7);
  return d.getTime();
}

/** Local-midnight timestamp of the first day of the current month. */
export function startOfMonth(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

/** Local-midnight timestamp of the first day of next month (reset countdown). */
export function nextMonthReset(now: number): number {
  const d = new Date(startOfMonth(now));
  d.setMonth(d.getMonth() + 1);
  return d.getTime();
}

/** Local YYYY-MM-DD key for a timestamp (matches the gateway's daily date keys). */
export function localYmd(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Sum daily-bucket cost for buckets whose start is at/after `from`. */
function sumCostSince(buckets: { start: number; cost: number }[] | undefined, from: number): number {
  if (!buckets) return 0;
  return buckets.reduce((s, b) => (b.start >= from ? s + b.cost : s), 0);
}

/** Sum daily-bucket cost for buckets whose start falls today. */
export function sumCostToday(
  buckets: { start: number; cost: number }[] | undefined,
  now: number,
): number {
  return sumCostSince(buckets, startOfDay(now));
}

/** Sum daily-bucket cost for buckets whose start falls in the current week. */
export function sumCostThisWeek(
  buckets: { start: number; cost: number }[] | undefined,
  ws: WeekStart,
  now: number,
): number {
  return sumCostSince(buckets, startOfWeek(now, ws));
}

/** Sum daily-bucket cost for buckets whose start falls in the current month. */
export function sumCostThisMonth(
  buckets: { start: number; cost: number }[] | undefined,
  now: number,
): number {
  return sumCostSince(buckets, startOfMonth(now));
}
