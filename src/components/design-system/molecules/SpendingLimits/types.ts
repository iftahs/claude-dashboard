import type { BudgetPeriod } from '@/lib/budget';

export interface SpendingLimitsProps {
  /** Calendar-aligned budget periods (today / this week / this month). */
  rows: BudgetPeriod[];
  /** Header note, e.g. "actual · via gateway" or "estimated from local logs". */
  note: string;
  /** Always render rows even without a cap (API mode — the spend IS the bill). */
  alwaysShow?: boolean;
}
