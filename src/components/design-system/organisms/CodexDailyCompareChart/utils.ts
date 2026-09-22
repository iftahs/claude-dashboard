import { localYmd } from '@/lib/week';
import type { DailyActivity } from '@/types';
import type { CompareRow } from './types';

const DAY = 86_400_000;

/** Series colours: the Codex model family's canonical violet (lib/palette) for the
 *  authoritative server count, and the Codex *surface* colour used by the Sources
 *  split for what the local rollouts add up to. */
export const SERVER_COLOR = '#8a3af0';
export const LOCAL_COLOR = '#14b8a6';

/**
 * One row per calendar day for the last `days` days ending today, joining the two
 * series on their `YYYY-MM-DD` key. The server buckets are UTC days and the local
 * ones local-midnight days, so a day's boundary can shift by the UTC offset — the
 * join is deliberately by key (that is how OpenAI labels the day too); the section
 * help explains the caveat.
 */
export function mergeDaily(
  server: { date: string; tokens: number }[],
  local: DailyActivity[],
  days: number,
  now = Date.now(),
): CompareRow[] {
  const s = new Map(server.map((d) => [d.date, d.tokens]));
  const l = new Map(local.map((d) => [d.date, d.effectiveTokens]));
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const rows: CompareRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = start.getTime() - i * DAY;
    const key = localYmd(t);
    rows.push({
      date: key,
      label: new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      server: s.get(key) ?? 0,
      local: l.get(key) ?? 0,
    });
  }
  return rows;
}

/** Window totals + how far the local sum sits from the server figure (null when the server is empty). */
export function compareTotals(rows: CompareRow[]): { server: number; local: number; deltaPct: number | null } {
  const server = rows.reduce((a, r) => a + r.server, 0);
  const local = rows.reduce((a, r) => a + r.local, 0);
  const deltaPct = server > 0 ? Math.round(((local - server) / server) * 100) : null;
  return { server, local, deltaPct };
}
