import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { spendingBarColor } from './utils';
import type { SpendingLimitsProps } from './types';

export function SpendingLimits({ limits, costPerDay }: SpendingLimitsProps) {
  const rows = [
    limits.dailyLimit != null
      ? { label: 'Daily', cost: costPerDay, limit: limits.dailyLimit }
      : null,
    limits.weeklyLimit != null
      ? { label: 'Weekly', cost: costPerDay * 7, limit: limits.weeklyLimit }
      : null,
    limits.monthlyLimit != null
      ? { label: 'Monthly (est.)', cost: costPerDay * 30, limit: limits.monthlyLimit }
      : null,
  ].filter(Boolean) as { label: string; cost: number; limit: number }[];

  if (rows.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">API Spending</h3>
        <span className="text-xs text-zinc-600">estimated from local logs</span>
      </div>
      <div className="space-y-4">
        {rows.map(({ label, cost, limit }) => {
          const pct = Math.min(100, (cost / limit) * 100);
          const color = spendingBarColor(pct);
          return (
            <div key={label}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">{label}</span>
                <span className="font-mono" style={{ color }}>
                  ${cost.toFixed(2)}{' '}
                  <span className="text-zinc-600">/ ${limit}</span>
                  <span className="ml-1.5 text-zinc-500">({pct.toFixed(0)}%)</span>
                </span>
              </div>
              <ProgressBar pct={pct} color={color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
