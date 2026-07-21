import type { ActiveBlock, WeeklyData, LiveUsageData } from '@/types';
import type { WeekStart } from '@/lib/week';

export interface PlanUsageProps {
  block: ActiveBlock | null;
  weekly: WeeklyData | null;
  liveUsage?: LiveUsageData | null;
  /** First day of the week — drives the weekly-reset countdown fallback. */
  weekStart: WeekStart;
  /** Plan / rate-limit tier label (e.g. "max_20x") shown as the source of these ceilings. */
  tier?: string | null;
  /** Multi-account mode: the account's email/label, shown as the card title. */
  accountLabel?: string | null;
  /** Render a muted "token stale" card — an idle account whose snapshot expired. */
  stale?: boolean;
  /** Highlight ring for the account currently in the shared credential slot. */
  active?: boolean;
}
