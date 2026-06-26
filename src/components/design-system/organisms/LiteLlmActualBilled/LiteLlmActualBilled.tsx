import { Section } from '@/components/design-system/molecules/Section/Section';
import { LiteLlmDailyChart } from '@/components/design-system/organisms/LiteLlmDailyChart/LiteLlmDailyChart';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { compact, usd } from '@/lib/format';
import type { LiteLlmActualBilledProps } from './types';
import { computeBilledSummary } from './utils';

/**
 * Actual billed cost from a LiteLLM gateway: month-to-date + per-day window,
 * side by side, with the month token mix. Gated by the caller; this only renders
 * once a non-error spend report is available.
 */
export function LiteLlmActualBilled({ spend, host, weekDays }: LiteLlmActualBilledProps) {
  const { daily, windowTotal, prev, monthDelta, fail, successPct, tok, tokTotal, tokPct } =
    computeBilledSummary(spend);

  return (
    <Section
      title="Actual billed"
      help="Real cost billed by your LiteLLM gateway, from its /user/daily/activity report. Month-to-date covers the 1st of the month → today; the daily view breaks out each calendar day in the selected window, including today. May exceed the estimate because the gateway also bills failed/retried requests."
      right={
        host ? (
          <span className="text-xs text-zinc-500">
            gateway <span className="font-semibold text-zinc-300">{host}</span>
          </span>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Month-to-date */}
        <div className="flex flex-col justify-center rounded-xl bg-emerald-500/[0.06] p-5 ring-1 ring-emerald-500/20">
          <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-300/80">
            {spend.monthLabel} · month-to-date
          </div>
          <div className="mt-1.5 text-4xl font-bold tabular-nums text-emerald-400">
            {usd(spend.monthToDate)}
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            {spend.monthRequests.toLocaleString()} requests since the 1st
          </div>
          {monthDelta !== null && (
            <div className="mt-1.5 text-xs text-zinc-500">
              <span className={monthDelta >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                {monthDelta >= 0 ? '▲' : '▼'} {Math.abs(monthDelta)}%
              </span>{' '}
              vs {usd(prev)} in {spend.prevMonthLabel} (same point)
            </div>
          )}
          {successPct !== null && (
            <div className="mt-1.5 text-xs text-zinc-500">
              <span className={successPct >= 99 ? 'text-emerald-400' : successPct >= 95 ? 'text-amber-400' : 'text-red-400'}>
                {successPct.toFixed(1)}% success
              </span>
              {fail > 0 && <span className="text-zinc-600"> · {fail.toLocaleString()} failed</span>}
            </div>
          )}
          {spend.lifetime.user > 0 && (
            <div className="mt-1 text-xs text-zinc-600">
              lifetime · <span className="text-zinc-400">{usd(spend.lifetime.user)}</span>
            </div>
          )}
        </div>
        {/* Daily breakdown over the selected window */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Last {weekDays} days
            </span>
            <span className="text-xs text-zinc-400">
              <span className="font-semibold text-zinc-200">{usd(windowTotal)}</span> total
            </span>
          </div>
          <LiteLlmDailyChart days={daily} />
        </div>
      </div>
      {tokTotal > 0 && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Token mix · {spend.monthLabel}
            </span>
            <span className="text-xs text-zinc-400">{compact(tokTotal)} total</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10">
            <div style={{ width: tokPct(tok.prompt), backgroundColor: '#d97757' }} />
            <div style={{ width: tokPct(tok.completion), backgroundColor: '#6366f1' }} />
            <div style={{ width: tokPct(tok.cacheCreate), backgroundColor: '#f59e0b' }} />
            <div style={{ width: tokPct(tok.cacheRead), backgroundColor: '#10b981' }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            <LegendDot color="#d97757" label={`Input · ${compact(tok.prompt)}`} size="sm" />
            <LegendDot color="#6366f1" label={`Output · ${compact(tok.completion)}`} size="sm" />
            <LegendDot color="#f59e0b" label={`Cache write · ${compact(tok.cacheCreate)}`} size="sm" />
            <LegendDot color="#10b981" label={`Cache read · ${compact(tok.cacheRead)}`} size="sm" />
          </div>
        </div>
      )}
    </Section>
  );
}
