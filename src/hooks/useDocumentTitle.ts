import { useEffect } from 'react';
import { useLiveMetrics } from './useLiveMetrics';

const BASE_TITLE = 'Claude Usage Dashboard';

/**
 * Mirrors the current 5-hour limit into the browser tab, so the number stays
 * readable while the dashboard sits in a background tab.
 *
 * The percentage leads: tabs truncate from the right, and a narrow tab should
 * keep the number rather than the word "Claude". Falls back to the bare title
 * when there's no active block or the live API is unreachable — in a tab you
 * aren't looking at, a stale percentage is worse than none.
 */
export function useDocumentTitle(): void {
  const { fiveHourPct } = useLiveMetrics();

  useEffect(() => {
    document.title = fiveHourPct == null ? BASE_TITLE : `${fiveHourPct}% · ${BASE_TITLE}`;
  }, [fiveHourPct]);
}
