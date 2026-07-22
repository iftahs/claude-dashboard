import { PlanUsage } from '@/components/design-system/molecules/PlanUsage/PlanUsage';
import type { AccountsLivePanelProps } from './types';

/**
 * Side-by-side live plan/limits for every logged-in account with live usage
 * (see /api/accounts/live, which already drops expired/idle accounts). Reuses
 * the single-account PlanUsage card per account — `block`/`weekly` are null
 * because the live payload drives the bars.
 */
export function AccountsLivePanel({ accounts, weekStart }: AccountsLivePanelProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {accounts.map((acc) => (
        <PlanUsage
          key={acc.key}
          block={null}
          weekly={null}
          liveUsage={acc.live}
          weekStart={weekStart}
          tier={acc.subscriptionType ?? acc.rateLimitTier ?? null}
          accountLabel={acc.label}
          active={acc.isActive}
        />
      ))}
    </div>
  );
}
