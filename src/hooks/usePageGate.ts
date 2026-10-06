import type { RouteId } from '@/routes';
import { useConfigMode } from './useConfigMode';
import { useLiveData } from './useLiveData';
import { useSource } from './useSource';
import type { Platform } from './useSource';

export type PageGate =
  | { state: 'content'; liveOnly: boolean; platform: Platform }
  | { state: 'empty'; platform: Platform }
  | { state: 'error'; message: string };

// Live limits come from the provider, not local logs, so these pages still have something true to show with no local usage.
const LIVE_LIMIT_ROUTES: readonly RouteId[] = ['overview', 'live'];

export function usePageGate(routeId: RouteId): PageGate {
  const { platform, showClaude, showCodex, hasScopeData, sourcesError } = useSource();
  const { recent, weekly, liveUsage, codexLive } = useLiveData();
  const { isApi } = useConfigMode();

  if (routeId === 'settings') return { state: 'content', liveOnly: false, platform };
  // The server never answered: say so, rather than claiming there is no usage.
  if (sourcesError) return { state: 'error', message: sourcesError.replace(/^Error:\s*/, '') };

  // "Empty" = zero events ever (lifetime, from /api/sources), not just an empty window: an idle-today user must still see history.
  const windowsEmpty =
    !recent.loading &&
    !weekly.loading &&
    (recent.data?.totals.totalTokens ?? 0) === 0 &&
    (weekly.data?.totals.totalTokens ?? 0) === 0;
  const empty = hasScopeData === false && windowsEmpty;
  const hasLiveLimits =
    (showClaude && !isApi && !!liveUsage.data && !liveUsage.data.error) ||
    (showCodex && !!codexLive.data && !codexLive.data.error);
  const liveOnly = empty && LIVE_LIMIT_ROUTES.includes(routeId) && hasLiveLimits;

  if (empty && !liveOnly) return { state: 'empty', platform };
  return { state: 'content', liveOnly, platform };
}
