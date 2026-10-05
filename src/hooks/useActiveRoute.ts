import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveRoute } from '@/routes';
import type { AppRoute } from '@/routes';
import { useSource } from './useSource';

export function useActiveRoute(): AppRoute {
  const { pathname } = useLocation();
  const { platform } = useSource();
  return useMemo(() => resolveRoute(pathname, platform), [pathname, platform]);
}
