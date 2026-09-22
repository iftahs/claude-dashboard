import { useEffect, useState } from 'react';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { blockBarColor } from './utils';
import { untilFull, dateTimeLabel } from '@/lib/format';
import { nextWeekReset, startOfWeek } from '@/lib/week';
import { buildWeeklyForecast } from '@/lib/forecast';
import type { PlanUsageProps } from './types';

const WEEK_MS = 7 * 24 * 3600_000;

const DEFAULT_BLOCK_LIMIT = 6000000; // 6.0M effective tokens
const DEFAULT_WEEKLY_LIMIT = 35000000; // 35M effective tokens

// Per-model weekly bar (normalized across the new limits[] array and legacy keys).
type WeeklyModelBar = { label: string; pct: number; resetsAt: string | null; color: string };
const MODEL_COLORS: Record<string, string> = {
  Opus: '#a78bfa',
  Sonnet: '#10b981',
  Haiku: '#f472b6',
  Fable: '#f59e0b',
};
const DEFAULT_MODEL_COLOR = '#22d3ee';

// Anthropic's display_name is a plain family word today ("Opus"), but a generation
// may get appended ("Opus 5") — match the family out of it rather than keying on the
// whole string, which would silently drop every bar to DEFAULT_MODEL_COLOR.
function modelBarColor(displayName: string): string {
  const family = displayName.match(/fable|mythos|opus|sonnet|haiku/i)?.[0].toLowerCase();
  const key = family && family[0].toUpperCase() + family.slice(1);
  return (key && MODEL_COLORS[key]) || DEFAULT_MODEL_COLOR;
}

// Default copy — the Claude.ai wording. Callers for another plan system (the
// Codex tab) override these via `help` / `labels` without touching this file.
const DEFAULT_HELP =
  "Your live subscription rate-limit ceilings from Claude.ai: the 5-hour window plus the weekly all-models, per-model and Cowork caps, each with % used and time to reset. Pulled from Anthropic's usage API — these are surfaced for awareness, not enforced.";
const DEFAULT_BLOCK_LABEL = '5-hour limit';
const DEFAULT_WEEKLY_LABEL = 'Weekly · all models';

export function PlanUsage({
  block,
  weekly,
  liveUsage,
  weekStart,
  tier,
  accountLabel,
  active,
  help,
  labels,
  note,
}: PlanUsageProps) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => forceUpdate((n) => n + 1), 60000); // refresh every minute for timers
    return () => clearInterval(timer);
  }, []);

  const tierLabel = tier ? tier.replace(/_/g, ' ').toUpperCase() : null;
  const cardClass = `card p-5 flex flex-col justify-between flex-none${active ? ' ring-1 ring-clay-500/40' : ''}`;
  const title = accountLabel ?? 'Plan usage';
  const titleSpanClass = accountLabel ? 'truncate normal-case' : 'uppercase';

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
  const blockResetStr = noActiveBlock ? 'on next msg' : untilFull(blockResetsAt);

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
  const weeklyResetStr = noActiveWeekly ? 'on next msg' : untilFull(weeklyResetsAt);

  // Burn-rate forecast for the weekly window (LiteLLM-inspired): where usage lands
  // by reset at the current pace. Window start is Anthropic's (resets−7d) when live,
  // else the user's calendar week. Suppressed when there's no active weekly window.
  const weeklyWindowStart = liveWeeklyResetsAt && !isNaN(liveWeeklyResetsAt)
    ? liveWeeklyResetsAt - WEEK_MS
    : startOfWeek(now, weekStart);
  const weeklyForecast = noActiveWeekly
    ? null
    : buildWeeklyForecast({ pct: weeklyPctRaw, windowStart: weeklyWindowStart, resetsAt: weeklyResetsAt, now });

  // Model-specific weekly limits — only present on some plans (e.g. Max exposes a
  // Sonnet/Opus cap; newer accounts expose Fable). Anthropic's current API delivers
  // these as `limits[]` entries with kind 'weekly_scoped' (the top-level
  // seven_day_<model> keys are being phased out → all null). Prefer the array;
  // fall back to the legacy keys for older responses.
  const scopedFromLimits: WeeklyModelBar[] = hasLive
    ? (liveUsage.limits ?? [])
        .filter((l) => l.group === 'weekly' && l.kind === 'weekly_scoped' && l.scope?.model?.display_name)
        .map((l) => {
          const name = l.scope!.model!.display_name!;
          return { label: `Weekly · ${name}`, pct: Math.round(l.percent), resetsAt: l.resets_at, color: modelBarColor(name) };
        })
    : [];

  const legacyModelLimits: WeeklyModelBar[] = hasLive
    ? ([
        { label: 'Weekly · Sonnet', info: liveUsage.seven_day_sonnet, color: MODEL_COLORS.Sonnet },
        { label: 'Weekly · Opus', info: liveUsage.seven_day_opus, color: MODEL_COLORS.Opus },
        { label: 'Weekly · Cowork', info: liveUsage.seven_day_cowork, color: DEFAULT_MODEL_COLOR },
      ] as const)
        .filter((l) => l.info != null)
        .map((l) => ({ label: l.label, pct: Math.round(l.info!.utilization), resetsAt: l.info!.resets_at, color: l.color }))
    : [];

  const modelLimits: WeeklyModelBar[] = scopedFromLimits.length ? scopedFromLimits : legacyModelLimits;

  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-bold tracking-wider text-zinc-300">
          <span className={titleSpanClass}>{title}</span>
          <InfoTip text={help ?? DEFAULT_HELP} />
        </h3>
        {tierLabel ? (
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-400 ring-1 ring-white/10">
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
            <span className="font-semibold text-zinc-200">{labels?.block ?? DEFAULT_BLOCK_LABEL}</span>
            <span className="text-zinc-400 font-mono">
              {blockPct}% <span className="text-zinc-600 font-sans">·</span> resets {blockResetStr}
              {!noActiveBlock && <span className="text-zinc-600"> · {dateTimeLabel(blockResetsAt)}</span>}
            </span>
          </div>
          <ProgressBar pct={blockPct} color={blockBarColor(blockPct)} />
        </div>

        {/* Weekly limit row */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-zinc-200">{labels?.weekly ?? DEFAULT_WEEKLY_LABEL}</span>
            <span className="text-zinc-400 font-mono">
              {weeklyPct}% <span className="text-zinc-600 font-sans">·</span> resets {weeklyResetStr}
              {!noActiveWeekly && <span className="text-zinc-600"> · {dateTimeLabel(weeklyResetsAt)}</span>}
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
        {modelLimits.map(({ label, pct, resetsAt, color }) => {
          const parsed = resetsAt ? Date.parse(resetsAt) : NaN;
          const hasReset = resetsAt != null && !isNaN(parsed);
          const resetStr = resetsAt == null
            ? 'on next msg'
            : untilFull(isNaN(parsed) ? now : parsed);
          return (
            <div key={label} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-zinc-200">{label}</span>
                <span className="text-zinc-400 font-mono">
                  {pct}% <span className="text-zinc-600 font-sans">·</span> resets {resetStr}
                  {hasReset && <span className="text-zinc-600"> · {dateTimeLabel(parsed)}</span>}
                </span>
              </div>
              <ProgressBar pct={pct} color={color} />
            </div>
          );
        })}
      </div>
      {note && <p className="mt-3 text-[11px] text-zinc-500">{note}</p>}
    </div>
  );
}
