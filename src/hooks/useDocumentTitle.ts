import { useEffect } from 'react';
import { useLiveMetrics } from './useLiveMetrics';
import { useSource } from './useSource';
import { PLATFORM_NOUN } from '../lib/platform';
import { BRAND } from '@/components/design-system/organisms/Sidebar/utils';

/**
 * Mirrors the binding rate-limit window of the platform on screen into the browser tab, the same % the sidebar Live badge shows.
 *
 * The percentage leads: tabs truncate from the right, and a narrow tab should
 * keep the number rather than the name; the platform suffix says whose limit it is. Falls back to the bare title when there's no active window or the live API is unreachable.
 */
export function useDocumentTitle(): void {
  const { limitPct } = useLiveMetrics();
  const { platform, sourcesLoaded } = useSource();

  useEffect(() => {
    // No suffix until /api/sources says which platform this user is on (a Codex-only user starts on a 'claude' placeholder for that first moment).
    const base = sourcesLoaded ? `${BRAND} · ${PLATFORM_NOUN[platform]}` : BRAND;
    document.title = limitPct == null ? base : `${limitPct}% · ${base}`;
  }, [limitPct, platform, sourcesLoaded]);
}
