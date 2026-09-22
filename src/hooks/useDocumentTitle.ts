import { useEffect } from 'react';
import { useLiveMetrics } from './useLiveMetrics';

const BASE_TITLE = 'Claude Usage Dashboard';

/**
 * Mirrors the active platform's rate-limit utilization into the browser tab, so
 * the number stays readable while the dashboard sits in a background tab —
 * Claude's 5-hour window under Claude/Both, Codex's weekly one under Codex.
 *
 * The percentage leads: tabs truncate from the right, and a narrow tab should
 * keep the number rather than the word "Claude". Falls back to the bare title
 * when there's no active block or the live API is unreachable — in a tab you
 * aren't looking at, a stale percentage is worse than none.
 */
export function useDocumentTitle(): void {
  const { limitPct } = useLiveMetrics();

  useEffect(() => {
    document.title = limitPct == null ? BASE_TITLE : `${limitPct}% · ${BASE_TITLE}`;
  }, [limitPct]);
}
