import { useMemo } from 'react';
import { useLiveData } from './useLiveData';
import { coverageDays as coverageOf } from '@/lib/coverage';

export interface CostMetrics {
  /** Estimated equivalent API cost ÷ days of history in the selected window. */
  costPerDay: number;
  /** Days the per-day figures average over (≤ the window; see lib/coverage). */
  coverageDays: number;
  daysLeftInMonth: number;
  /** Month-end projection if the current daily average continues. */
  projectedMonthCost: number;
  weeklyEffective: number;
  prevWeeklyEffective: number;
}

/** Cost/effective-token rollups for the selected Trends window (shared with Live). */
export function useCostMetrics(): CostMetrics {
  const { weekly, weekDays } = useLiveData();

  return useMemo(() => {
    const weeklyEffective = weekly.data?.totals.effectiveTokens ?? 0;
    const prevWeeklyEffective = weekly.data?.prevTotals.effectiveTokens ?? 0;
    const coverageDays = coverageOf(weekly.data, weekDays);
    const costPerDay = (weekly.data?.totals.cost ?? 0) / coverageDays;
    const now = new Date();
    const daysLeftInMonth =
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    const projectedMonthCost = costPerDay * (now.getDate() + daysLeftInMonth);
    return { costPerDay, coverageDays, daysLeftInMonth, projectedMonthCost, weeklyEffective, prevWeeklyEffective };
  }, [weekly.data, weekDays]);
}
