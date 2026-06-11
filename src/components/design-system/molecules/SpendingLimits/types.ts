import type { Limits } from '@/hooks/useLimits';

export interface SpendingLimitsProps {
  limits: Limits;
  costPerDay: number;
}
