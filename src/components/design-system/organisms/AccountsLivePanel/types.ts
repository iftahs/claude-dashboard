import type { AccountLive } from '@/types';
import type { WeekStart } from '@/lib/week';

export interface AccountsLivePanelProps {
  /** One entry per logged-in account, from GET /api/accounts/live. */
  accounts: AccountLive[];
  /** First day of the week — drives the weekly-reset countdown fallback. */
  weekStart: WeekStart;
}
