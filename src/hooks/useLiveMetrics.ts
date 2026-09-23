import { useMemo } from 'react';
import { useLiveData } from './useLiveData';
import { useSource } from './useSource';
import { useConfigMode } from './useConfigMode';
import { limitReadings, type LimitReading } from '../lib/limits';
import type { LiveSubagents } from '../types';

/** The rate-limit window closest to its cap among the platforms on screen. */
export interface BindingLimit {
  /** 0–100, rounded; exactly 100 only when the provider says the window is exhausted. */
  pct: number;
  /** 'Claude' | 'Codex'. */
  platform: string;
  /** '5-hour limit' / 'weekly limit'. */
  label: string;
  reached: boolean;
}

export interface LiveMetrics {
  /** Running subagents + main sessions actively working or delegating, for the active platform. */
  runningAgentCount: number;
  liveWorkflowCount: number;
  /** Claude's current 5-hour limit utilization (0–100), or null when unavailable. */
  fiveHourPct: number | null;
  /** Codex (ChatGPT desktop) weekly limit utilization (0–100), or null when unavailable. */
  codexWeeklyPct: number | null;
  /** The binding window for the platform(s) on screen, or null when no live window is running. */
  binding: BindingLimit | null;
  /** `binding.pct` — the one number the sidebar badge and the tab title show. */
  limitPct: number | null;
  /** What `limitPct` measures, e.g. "Codex 5-hour limit". */
  limitTitle: string;
  /** Badge tooltip: which platform and window the % is, and why it was picked. */
  limitTooltip: string;
}

/** Running subagents + main sessions actively working or delegating, for one surface. */
function activeAgents(d: LiveSubagents | null): number {
  if (!d) return 0;
  return d.running.length + d.mainAgents.filter((m) => m.active || m.delegating).length;
}

// Highest % used wins (exhausted counts as 100); ties go to whichever resets later, since that keeps the user waiting longer.
export function bindingLimit(readings: readonly LimitReading[]): BindingLimit | null {
  let best: { r: LimitReading; pct: number } | null = null;
  for (const r of readings) {
    const pct = r.reached ? 100 : Math.max(0, Math.min(99, Math.round(r.pct)));
    if (
      !best ||
      pct > best.pct ||
      (pct === best.pct && (r.resetsAt ?? 0) > (best.r.resetsAt ?? 0))
    ) {
      best = { r, pct };
    }
  }
  return best && { pct: best.pct, platform: best.r.platform, label: best.r.label, reached: best.r.reached };
}

/**
 * Live counters derived from the shared live polls — drives the sidebar badges
 * (visible from any tab) and the Agents header chips. Everything is scoped to the
 * platform switcher: Claude only under 'claude', Codex only under 'codex', summed
 * under 'both'. The Codex polls are disabled unless Codex data exists, and the
 * platform is pinned to 'claude' in that case, so Claude-only users get exactly
 * the Claude numbers.
 *
 * `limitPct` is the BINDING window — the fuller of the 5-hour and weekly windows (100 if reached) for the platform
 * on screen, fullest across both under 'both' — not one fixed window, which could hide the limit about to hit.
 */
export function useLiveMetrics(): LiveMetrics {
  const { platform, showClaude, showCodex } = useSource();
  const { isApi } = useConfigMode();
  const { liveSubagents, codexAgents, codexLive, workflows, liveUsage } = useLiveData();

  const runningAgentCount =
    (showClaude ? activeAgents(liveSubagents.data) : 0) + (showCodex ? activeAgents(codexAgents.data) : 0);
  const liveWorkflowCount = workflows.data?.live.length ?? 0;
  const fiveHourPct =
    liveUsage.data && !liveUsage.data.error && liveUsage.data.five_hour?.resets_at != null
      ? Math.round(liveUsage.data.five_hour.utilization)
      : null;
  const codexWeekly = codexLive.data && !codexLive.data.error ? codexLive.data.weekly : null;
  const codexWeeklyPct = codexWeekly ? Math.round(codexWeekly.usedPct) : null;

  // Same readings the limit alerts watch (Claude.ai's windows only outside API mode).
  const claudeLive = showClaude && !isApi ? liveUsage.data : null;
  const codexData = showCodex ? codexLive.data : null;
  const { binding, windows } = useMemo(() => {
    const readings = limitReadings(claudeLive, codexData);
    return { binding: bindingLimit(readings), windows: readings.length };
  }, [claudeLive, codexData]);

  const limitTitle = binding ? `${binding.platform} ${binding.label}` : '';
  // Say why this window was picked only when there was a choice.
  const why =
    windows < 2 ? ''
    : platform === 'both' ? ' — the fullest window across Claude and Codex'
    : ` — the fullest of your ${binding?.platform ?? ''} windows`;
  const limitTooltip = binding
    ? `${limitTitle}: ${binding.reached ? 'limit reached' : `${binding.pct}% used`}${why}`
    : '';

  return {
    runningAgentCount,
    liveWorkflowCount,
    fiveHourPct,
    codexWeeklyPct,
    binding,
    limitPct: binding?.pct ?? null,
    limitTitle,
    limitTooltip,
  };
}
