import { ago, compact } from '@/lib/format';
import { CODEX_COVERAGE, type PlanGateRow } from '@/lib/gauge';
import type { CodexLiveData, CodexProfileStats, CodexWindow, LiveUsageData } from '@/types';
import type { CodexStat } from './types';

/** InfoTip copy for the Codex rate-limit card (overrides PlanUsage's Claude.ai default). */
export const CODEX_PLAN_HELP = `Your ChatGPT plan's Codex rate-limit windows: the 5-hour window and the weekly window, each with % used and time to reset, plus any premium model the plan gates separately. Read from OpenAI's usage API with the token the ChatGPT desktop app stores locally — surfaced for awareness, never enforced or refreshed by this dashboard. ${CODEX_COVERAGE}`;

/** Row labels for the two Codex windows. */
export const CODEX_PLAN_LABELS = { block: '5-hour limit', weekly: 'Weekly limit' };

// A window the plan lacks (e.g. 'go' has no 5-hour) stays null so PlanUsage hides the row instead of drawing a fake 0%.
function planWindow(w: CodexWindow | null) {
  return w ? { utilization: w.usedPct, resets_at: w.resetsAt } : null;
}

/** Adapt a (non-error) Codex live payload to the LiveUsageData subset PlanUsage reads. */
export function toPlanUsageLive(live: CodexLiveData): LiveUsageData {
  const shaped = { five_hour: planWindow(live.fiveHour), seven_day: planWindow(live.weekly) };
  return shaped as LiveUsageData;
}

// "Unavailable" during a plan-limit period almost always means the window, not the model — so it reads "paused".
export function codexModelGates(live: CodexLiveData): PlanGateRow[] {
  return Object.entries(live.modelAvailability ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, available]) => ({
      label: `Premium · ${slug}`,
      status: available ? 'available' : live.limitReached ? 'paused · plan limit reached' : 'not available right now',
      tone: available ? 'ok' : live.limitReached ? 'danger' : 'muted',
    }));
}

/** Footnote for a passive (rollout-snapshot) reading of the limits, with the server's reason when it sent one. */
export function snapshotNote(live: CodexLiveData): string {
  const at = live.snapshotAt ? Date.parse(live.snapshotAt) : NaN;
  const age = Number.isNaN(at) ? 'age unknown' : ago(at);
  const why = live.warning ? ` · ${live.warning}` : '';
  return `passive snapshot · ${age} — from the newest local rollout; open the ChatGPT app for live numbers${why}`;
}

// Not rendered on Live (lifetime figures belong on Trends/Sessions/Models); kept for tabs showing Claude equivalents.

/** "1h 12m" / "4m 20s" / "45s" for a duration in seconds. */
export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Server-side lifetime stats from the Codex profile endpoint (stats only, no profile). */
export function profileStats(p: CodexProfileStats): CodexStat[] {
  const effort = p.mostUsedReasoningEffort
    ? p.mostUsedReasoningEffort.charAt(0).toUpperCase() + p.mostUsedReasoningEffort.slice(1)
    : '—';
  return [
    {
      key: 'lifetime',
      label: 'Lifetime tokens',
      value: compact(p.lifetimeTokens),
      sub: 'server-side · every device',
      help: "OpenAI's own lifetime token count for this account — includes mobile and web Codex usage that never touches this machine.",
    },
    {
      key: 'peak',
      label: 'Peak day',
      value: compact(p.peakDailyTokens),
      sub: 'tokens in one UTC day',
    },
    {
      key: 'streak',
      label: 'Current streak',
      value: `${p.currentStreakDays}d`,
      sub: `longest ${p.longestStreakDays}d`,
      help: 'Consecutive UTC days with Codex activity, per OpenAI.',
    },
    {
      key: 'threads',
      label: 'Threads',
      value: p.totalThreads.toLocaleString(),
      sub: 'all time',
    },
    {
      key: 'longest-turn',
      label: 'Longest turn',
      value: formatSeconds(p.longestRunningTurnSec),
      sub: 'single agent turn',
    },
    {
      key: 'effort',
      label: 'Top reasoning effort',
      value: effort,
      sub: p.mostUsedReasoningEffortPct != null ? `${Math.round(p.mostUsedReasoningEffortPct)}% of turns` : undefined,
      help: 'The reasoning-effort setting (low / medium / high) your turns most often ran with.',
    },
  ];
}
