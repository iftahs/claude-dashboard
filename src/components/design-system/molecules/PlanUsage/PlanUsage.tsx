import { useEffect, useState } from 'react';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { formatRemainingHours, formatRemainingDays, blockBarColor } from './utils';
import type { PlanUsageProps } from './types';

const DEFAULT_BLOCK_LIMIT = 6000000; // 6.0M effective tokens
const DEFAULT_WEEKLY_LIMIT = 35000000; // 35M effective tokens

export function PlanUsage({ block, weekly, liveUsage }: PlanUsageProps) {
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
  const weeklyPct = hasLive
    ? Math.round(liveUsage.seven_day.utilization)
    : Math.min(100, Math.round(((weekly?.totals.effectiveTokens ?? 0) / weeklyLimit) * 100));

  const liveWeeklyResetsAt = hasLive ? Date.parse(liveUsage.seven_day.resets_at) : null;
  const noActiveWeekly = hasLive && liveUsage.seven_day.resets_at == null;
  const weeklyResetsAt = liveWeeklyResetsAt && !isNaN(liveWeeklyResetsAt) ? liveWeeklyResetsAt : (weekly?.weeklyResetsAt ?? (now + 5 * 24 * 3600_000));
  const weeklyRemainingMs = Math.max(0, weeklyResetsAt - now);
  const weeklyResetStr = noActiveWeekly ? 'on next msg' : formatRemainingDays(weeklyRemainingMs);

  return (
    <div className="card p-5 flex flex-col justify-between flex-none">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Plan usage</h3>
        <span className="text-zinc-500 font-mono text-xs select-none">→</span>
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
        </div>
      </div>
    </div>
  );
}
