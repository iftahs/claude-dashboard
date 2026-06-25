import { useMemo } from 'react';
import { useLiveData } from './useLiveData';

export interface CostMetrics {
  /** Estimated equivalent API cost ÷ days in the selected window. */
  costPerDay: number;
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
    const costPerDay = (weekly.data?.totals.cost ?? 0) / weekDays;
    const now = new Date();
    const daysLeftInMonth =
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    const projectedMonthCost = costPerDay * (now.getDate() + daysLeftInMonth);
    return { costPerDay, daysLeftInMonth, projectedMonthCost, weeklyEffective, prevWeeklyEffective };
  }, [weekly.data, weekDays]);
}
