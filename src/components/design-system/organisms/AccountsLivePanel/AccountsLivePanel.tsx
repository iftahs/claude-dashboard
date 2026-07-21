import { PlanUsage } from '@/components/design-system/molecules/PlanUsage/PlanUsage';
import type { AccountsLivePanelProps } from './types';

/**
 * Side-by-side live plan/limits for every logged-in account (see
 * /api/accounts/live). Reuses the single-account PlanUsage card per account —
 * `block`/`weekly` are null because the live payload drives the bars. An idle
 * account whose token snapshot expired renders the muted "stale" card.
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
          stale={acc.expired || !!acc.live?.error}
        />
      ))}
    </div>
  );
}
