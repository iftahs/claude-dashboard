import type { Limits } from '@/hooks/useLimits';

export interface SpendingLimitsProps {
  limits: Limits;
  costPerDay: number;
  /** Estimated cost over the current week window; falls back to costPerDay × 7. */
  weekCost?: number;
  /** Always render the spend rows (even without caps) — used in API mode. */
  alwaysShow?: boolean;
}
