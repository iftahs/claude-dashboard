import type { Limits } from '@/hooks/useLimits';

export interface SpendingLimitsProps {
  limits: Limits;
  costPerDay: number;
  /** Estimated cost over the current week window; falls back to costPerDay × 7. */
  weekCost?: number;
  /** Always render the spend rows (even without caps) — used in API mode. */
  alwaysShow?: boolean;
  /** When set, rows show the real billed cost (e.g. from a LiteLLM gateway) against
   *  the caps, instead of the local-logs estimate, and the header note reflects it. */
  actual?: { today: number; week: number; month: number; note: string };
}
