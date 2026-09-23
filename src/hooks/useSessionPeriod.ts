import { useMemo } from 'react';
import type { SessionMeta } from '../types';

export interface SessionPeriod {
  /** Days from the oldest listed session's start to now (0 when there are none). */
  days: number;
  /** The oldest listed session's start (epoch ms), null when there are none. */
  since: number | null;
}

// /api/sessions is not windowed — it lists every session on disk (or archived), so this is "since <date>", never a selectable "last N days" window.
export function useSessionPeriod(sessions: SessionMeta[] | null): SessionPeriod {
  return useMemo(() => {
    if (!sessions || sessions.length === 0) return { days: 0, since: null };
    let oldest = Infinity;
    for (const s of sessions) {
      const t = Date.parse(s.start_time);
      if (!Number.isNaN(t) && t < oldest) oldest = t;
    }
    if (oldest === Infinity) return { days: 0, since: null };
    return { days: Math.ceil((Date.now() - oldest) / 86_400_000), since: oldest };
  }, [sessions]);
}
