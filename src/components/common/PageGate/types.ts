import type { ReactNode } from 'react';
import type { RouteId } from '@/routes';

export interface PageGateProps {
  routeId: RouteId;
  children: ReactNode;
}
