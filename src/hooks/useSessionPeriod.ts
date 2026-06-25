import { useMemo } from 'react';
import type { SessionMeta } from '../types';

/** Days spanned from the oldest session's start to now (for per-day averages). */
export function useSessionPeriod(sessions: SessionMeta[] | null): number {
  return useMemo(() => {
    if (!sessions || sessions.length === 0) return 0;
    const timestamps = sessions
      .map((s) => Date.parse(s.start_time))
      .filter((t) => !isNaN(t));
    if (timestamps.length === 0) return 0;
    const oldest = Math.min(...timestamps);
    const diffMs = Date.now() - oldest;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }, [sessions]);
}
