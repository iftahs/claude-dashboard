import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { usd } from '@/lib/format';
import { formatResetCountdown } from '@/lib/budget';
import { spendingBarColor } from './utils';
import type { SpendingLimitsProps } from './types';

export function SpendingLimits({ rows, note, alwaysShow = false }: SpendingLimitsProps) {
  const actual = rows.some((r) => r.isActual);
  // API mode shows every row (the spend is the bill); subscription mode only
  // shows rows the user has set a cap for.
  const visible = alwaysShow ? rows : rows.filter((r) => r.cap != null);
  if (visible.length === 0) return null;
  const now = Date.now();

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-500">
          API Spending
          <InfoTip
            text={
              actual
                ? 'Real cost billed by your LiteLLM gateway (today, this week, this month) against the daily/weekly/monthly USD caps you set in ⚙ Settings. Caps reset on real calendar boundaries and are stored locally in your browser.'
                : 'Your estimated equivalent API spend against the daily/weekly/monthly USD caps you set (⚙ Settings). Caps reset on real calendar boundaries and are stored locally — this is a budgeting aid, not a real bill.'
            }
          />
        </h3>
        <span className="text-xs text-zinc-600">{note}</span>
      </div>
      <div className="space-y-4">
        {visible.map((r) => {
          if (r.cap == null || r.pct == null) {
            // No cap set — show the figure with a gentle nudge instead of a bar.
            return (
              <div key={r.key} className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">{r.label}</span>
                <span className="font-mono text-zinc-400">
                  {usd(r.spent)} <span className="text-zinc-600">· no cap set</span>
                </span>
              </div>
            );
          }
          const color = spendingBarColor(r.pct);
          return (
            <div key={r.key}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">
                  {r.label}
                  <span className="ml-1.5 font-normal text-zinc-600">
                    {formatResetCountdown(r.resetsAt, now)}
                  </span>
                </span>
                <span className="font-mono" style={{ color }}>
                  {usd(r.spent)} <span className="text-zinc-600">/ ${r.cap}</span>
                  <span className="ml-1.5 text-zinc-500">({r.pct.toFixed(0)}%)</span>
                </span>
              </div>
              <ProgressBar pct={r.pct} color={color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
