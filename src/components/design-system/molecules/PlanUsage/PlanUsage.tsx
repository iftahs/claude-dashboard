import { useEffect, useState } from 'react';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { formatRemainingHours, formatRemainingDays, blockBarColor } from './utils';
import { nextWeekReset, startOfWeek } from '@/lib/week';
import { buildWeeklyForecast } from '@/lib/forecast';
import type { PlanUsageProps } from './types';

const WEEK_MS = 7 * 24 * 3600_000;

const DEFAULT_BLOCK_LIMIT = 6000000; // 6.0M effective tokens
const DEFAULT_WEEKLY_LIMIT = 35000000; // 35M effective tokens

export function PlanUsage({ block, weekly, liveUsage, weekStart, tier }: PlanUsageProps) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => forceUpdate((n) => n + 1), 60000); // refresh every minute for timers
    return () => clearInterval(timer);
  }, []);

  const now = Date.now();

  const hasLive = liveUsage && !liveUsage.error;

  // 5-Hour Limit calculations
  const blockLimit = DEFAULT_BLOCK_LIMIT;
  const blockPct = hasLive
    ? Math.round(liveUsage.five_hour.utilization)
    : Math.min(100, Math.round(((block?.totals.effectiveTokens ?? 0) / blockLimit) * 100));

  const liveResetsAt = hasLive ? Date.parse(liveUsage.five_hour.resets_at) : null;
  const noActiveBlock = hasLive && liveUsage.five_hour.resets_at == null;
  const blockResetsAt = liveResetsAt && !isNaN(liveResetsAt) ? liveResetsAt : (block?.resetsAt ?? (now + 5 * 3600_000));
  const blockRemainingMs = Math.max(0, blockResetsAt - now);
  const blockResetStr = noActiveBlock ? 'on next msg' : formatRemainingHours(blockRemainingMs);

  // Weekly calculations
  const weeklyLimit = DEFAULT_WEEKLY_LIMIT;
  const weeklyPctRaw = hasLive
    ? liveUsage.seven_day.utilization
    : Math.min(100, ((weekly?.totals.effectiveTokens ?? 0) / weeklyLimit) * 100);
  const weeklyPct = Math.round(weeklyPctRaw);

  const liveWeeklyResetsAt = hasLive ? Date.parse(liveUsage.seven_day.resets_at) : null;
  const noActiveWeekly = hasLive && liveUsage.seven_day.resets_at == null;
  // Live Anthropic reset wins; otherwise fall back to the user's configured week start.
  const weeklyResetsAt = liveWeeklyResetsAt && !isNaN(liveWeeklyResetsAt)
    ? liveWeeklyResetsAt
    : nextWeekReset(now, weekStart);
  const weeklyRemainingMs = Math.max(0, weeklyResetsAt - now);
  const weeklyResetStr = noActiveWeekly ? 'on next msg' : formatRemainingDays(weeklyRemainingMs);

  // Burn-rate forecast for the weekly window (LiteLLM-inspired): where usage lands
  // by reset at the current pace. Window start is Anthropic's (resets−7d) when live,
  // else the user's calendar week. Suppressed when there's no active weekly window.
  const weeklyWindowStart = liveWeeklyResetsAt && !isNaN(liveWeeklyResetsAt)
    ? liveWeeklyResetsAt - WEEK_MS
    : startOfWeek(now, weekStart);
  const weeklyForecast = noActiveWeekly
    ? null
    : buildWeeklyForecast({ pct: weeklyPctRaw, windowStart: weeklyWindowStart, resetsAt: weeklyResetsAt, now });

  // Model-specific weekly limits — only present on some plans (e.g. Max exposes a Sonnet cap).
  const modelLimits = hasLive
    ? ([
        { label: 'Weekly · Sonnet', info: liveUsage.seven_day_sonnet, color: '#10b981' },
        { label: 'Weekly · Opus', info: liveUsage.seven_day_opus, color: '#a78bfa' },
        { label: 'Weekly · Cowork', info: liveUsage.seven_day_cowork, color: '#22d3ee' },
      ] as const).filter((l) => l.info != null)
    : [];

  const tierLabel = tier ? tier.replace(/_/g, ' ').toUpperCase() : null;

  return (
    <div className="card p-5 flex flex-col justify-between flex-none">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-300">
          Plan usage
          <InfoTip text="Your live subscription rate-limit ceilings from Claude.ai: the 5-hour window plus the weekly all-models, per-model and Cowork caps, each with % used and time to reset. Pulled from Anthropic's usage API — these are surfaced for awareness, not enforced." />
        </h3>
        {tierLabel ? (
          <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-400 ring-1 ring-white/10">
            {tierLabel}
          </span>
        ) : (
          <span className="text-zinc-500 font-mono text-xs select-none">→</span>
        )}
      </div>

      <div className="space-y-4">
        {/* 5-hour limit row */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-zinc-200">5-hour limit</span>
            <span className="text-zinc-400 font-mono">
              {blockPct}% <span className="text-zinc-600 font-sans">·</span> resets {blockResetStr}
            </span>
          </div>
          <ProgressBar pct={blockPct} color={blockBarColor(blockPct)} />
        </div>

        {/* Weekly limit row */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-zinc-200">Weekly · all models</span>
            <span className="text-zinc-400 font-mono">
              {weeklyPct}% <span className="text-zinc-600 font-sans">·</span> resets {weeklyResetStr}
            </span>
          </div>
          <ProgressBar pct={weeklyPct} variant="blue" />
          {weeklyForecast && (
            <div className="flex items-center gap-1 text-[11px]" style={{ color: weeklyForecast.color }}>
              <span>{weeklyForecast.willExceed ? '⚠' : '↗'}</span>
              <span>{weeklyForecast.label}</span>
            </div>
          )}
        </div>

        {/* Per-model weekly limits (shown only when the live API reports them) */}
        {modelLimits.map(({ label, info, color }) => {
          const pct = Math.round(info!.utilization);
          const resetsAt = Date.parse(info!.resets_at);
          const resetStr = info!.resets_at == null
            ? 'on next msg'
            : formatRemainingDays(Math.max(0, (isNaN(resetsAt) ? now : resetsAt) - now));
          return (
            <div key={label} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-zinc-200">{label}</span>
                <span className="text-zinc-400 font-mono">
                  {pct}% <span className="text-zinc-600 font-sans">·</span> resets {resetStr}
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
