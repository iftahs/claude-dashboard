import type { Limits } from '@/hooks/useLimits';
import type { WeekStart } from './week';
import { nextDayReset, nextWeekReset, nextMonthReset, sumCostToday, sumCostThisWeek } from './week';

/** One calendar budget period (day/week/month) with spend vs an optional cap. */
export interface BudgetPeriod {
  key: 'day' | 'week' | 'month';
  label: string;
  /** Spend so far in the current calendar period. */
  spent: number;
  /** USD cap, or null when the user hasn't set one. */
  cap: number | null;
  /** Spend ÷ cap as a 0–100 percentage, or null when there's no cap. */
  pct: number | null;
  /** Epoch ms when this calendar period rolls over. */
  resetsAt: number;
  /** True when `spent` is real billed cost (gateway), false for the local estimate. */
  isActual: boolean;
}

export interface BudgetInput {
  limits: Limits;
  /** Daily cost buckets (from /api/usage/weekly) for the estimate path. */
  buckets?: { start: number; cost: number }[];
  /** Average $/day over the window — used for the month-to-date estimate. */
  costPerDay: number;
  weekStart: WeekStart;
  /** Real billed slices (LiteLLM gateway); when present they override the estimate. */
  actual?: { today: number; week: number; month: number } | null;
  now: number;
}

/**
 * Per-period spend vs caps, aligned to real calendar boundaries (today / this
 * week per the week-start preference / this month). Prefers real billed spend
 * when a gateway report is available; otherwise estimates from local logs. The
 * month-to-date estimate uses costPerDay × day-of-month because the weekly
 * buckets only span the recent window, not the whole month.
 */
export function buildBudgetRows({
  limits,
  buckets,
  costPerDay,
  weekStart,
  actual,
  now,
}: BudgetInput): BudgetPeriod[] {
  const isActual = !!actual;
  const dayOfMonth = new Date(now).getDate();

  const today = actual ? actual.today : sumCostToday(buckets, now);
  const week = actual ? actual.week : sumCostThisWeek(buckets, weekStart, now);
  const month = actual ? actual.month : costPerDay * dayOfMonth;

  const row = (
    key: BudgetPeriod['key'],
    label: string,
    spent: number,
    cap: number | null,
    resetsAt: number,
  ): BudgetPeriod => ({
    key,
    label,
    spent,
    cap,
    pct: cap != null && cap > 0 ? Math.min(100, (spent / cap) * 100) : null,
    resetsAt,
    isActual,
  });

  return [
    row('day', 'Today', today, limits.dailyLimit, nextDayReset(now)),
    row('week', 'This week', week, limits.weeklyLimit, nextWeekReset(now, weekStart)),
    row('month', 'This month', month, limits.monthlyLimit, nextMonthReset(now)),
  ];
}

/** Compact "resets in 4h" / "resets in 3d" countdown for a budget period. */
export function formatResetCountdown(resetsAt: number, now: number): string {
  const ms = Math.max(0, resetsAt - now);
  const h = ms / 3_600_000;
  if (h < 1) return `resets in ${Math.max(1, Math.round(ms / 60_000))}m`;
  if (h < 24) return `resets in ${Math.round(h)}h`;
  return `resets in ${Math.round(h / 24)}d`;
}
