import { usePolling } from './usePolling';
import type { SessionUsageData } from '@/types';

const SESSION_USAGE_POLL_MS = 15_000;

export interface SessionUsagePoll {
  data: SessionUsageData | null;
  error: string | null;
}

/** One session's usage breakdown; an empty id polls nothing. */
export function useSessionUsage(sessionId: string | null): SessionUsagePoll {
  const poll = usePolling<SessionUsageData>(sessionId ? `/api/sessions/${encodeURIComponent(sessionId)}/usage` : '', SESSION_USAGE_POLL_MS);
  // The state still holds the previous session's answer for one render after the id changes.
  return { data: poll.data && poll.data.sessionId === sessionId ? poll.data : null, error: poll.error };
}
