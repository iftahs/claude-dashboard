import { ymdLabel } from '@/lib/format';
import type { DailyActivity } from '@/types';
import type { CompareRow } from './types';

const DAY = 86_400_000;

/** Series colours: the Codex model family's canonical violet (lib/palette) for the
 *  authoritative server count, and the Codex *surface* colour used by the Sources
 *  split for what the local rollouts add up to. */
export const SERVER_COLOR = '#8a3af0';
export const LOCAL_COLOR = '#14b8a6';

// Joins by UTC YYYY-MM-DD key; plots `totalTokens` (not effective) — the unit OpenAI's server count matches, ~20x higher than effective on a cache-heavy day.
export function mergeDaily(
  server: { date: string; tokens: number }[],
  local: DailyActivity[],
  days: number,
  now = Date.now(),
): CompareRow[] {
  const s = new Map(server.map((d) => [d.date, d.tokens]));
  const l = new Map(local.map((d) => [d.date, d.totalTokens ?? 0]));
  const today = new Date(now);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const rows: CompareRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(start - i * DAY).toISOString().slice(0, 10);
    rows.push({
      date: key,
      label: ymdLabel(key, days > 60),
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
