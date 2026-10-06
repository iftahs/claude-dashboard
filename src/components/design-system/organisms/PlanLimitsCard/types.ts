import type { PlanLimitsView } from '@/lib/views/live';

export type PlanLimitsColumns = 1 | 2;

export interface PlanLimitsCardProps {
  view: PlanLimitsView;
  columns?: PlanLimitsColumns;
  className?: string;
}
