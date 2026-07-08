import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { usd } from '@/lib/format';
import { toMajorUnits, disabledReasonLabel, parseDisclaimer, extraUsageBarColor } from './utils';
import type { ExtraUsageCardProps } from './types';

export function ExtraUsageCard({ extraUsage, spend, orgEnabled = false }: ExtraUsageCardProps) {
  const disclaimer = parseDisclaimer(spend?.disclaimer);
  const used = toMajorUnits(extraUsage.used_credits, extraUsage.decimal_places);
  const limit = toMajorUnits(extraUsage.monthly_limit, extraUsage.decimal_places);
  const pct = extraUsage.utilization != null
    ? Math.round(extraUsage.utilization)
    : limit ? Math.round(((used ?? 0) / limit) * 100) : null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-500">
          Extra usage
          <InfoTip text="Once you hit your plan's included limit, extra usage bills at standard API rates from your organization's pre-purchased credit pool (if your admin has enabled it)." />
        </h3>
      </div>

      {extraUsage.is_enabled ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-300">This month</span>
            <span className="font-mono text-zinc-400">
              {used != null ? usd(used) : '—'}
              {limit != null && <span className="text-zinc-600"> / {usd(limit)}</span>}
              {pct != null && <span className="ml-1.5 text-zinc-500">({pct}%)</span>}
            </span>
          </div>
          <ProgressBar pct={pct ?? 0} color={pct != null ? extraUsageBarColor(pct) : undefined} />
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          {orgEnabled
            ? (disabledReasonLabel(extraUsage.disabled_reason) ??
              'Not currently available — usage pauses at your plan limit until the next reset.')
            : "Your organization hasn't enabled extra usage — usage pauses at your plan limit until the next reset."}
        </p>
      )}

      {(disclaimer.text || disclaimer.linkText) && (
        <p className="mt-3 text-[11px] text-zinc-600">
          {disclaimer.text}
          {disclaimer.text && disclaimer.linkText ? ' ' : ''}
          {disclaimer.href && disclaimer.linkText && (
            <a href={disclaimer.href} target="_blank" rel="noreferrer" className="underline hover:text-zinc-400">
              {disclaimer.linkText}
            </a>
          )}
        </p>
      )}
    </div>
  );
}
