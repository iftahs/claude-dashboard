import type { ReactNode } from 'react';
import type { Limits } from '@/lib/limits';
import type { RouteId } from '@/routes';

export interface LegacyTabContext {
  limits: Limits;
}

export interface LegacyTabFrameProps {
  routeId: RouteId;
  children: ReactNode | ((context: LegacyTabContext) => ReactNode);
}
