import { ago, compact } from '@/lib/format';
import { codexProjectLabel } from '@/lib/project';
import type { CodexLiveData, CodexProfileStats, CodexWindow, LiveSubagents, LiveUsageData } from '@/types';
import type { CodexStat } from './types';

/**
 * Map one Codex window onto the `{ utilization, resets_at }` shape PlanUsage reads.
 * `resets_at` is null when the window has lapsed or is unknown — PlanUsage already
 * treats a null reset as "no active window" (Anthropic's payload does the same at
 * runtime; the `LiveLimitInfo` type just doesn't say so), hence the single cast in
 * `toPlanUsageLive`.
 */
function planWindow(w: CodexWindow | null) {
  return { utilization: w?.usedPct ?? 0, resets_at: w?.resetsAt ?? null };
}

/** Adapt a (non-error) Codex live payload to the LiveUsageData subset PlanUsage reads. */
export function toPlanUsageLive(live: CodexLiveData): LiveUsageData {
  const shaped = { five_hour: planWindow(live.fiveHour), seven_day: planWindow(live.weekly) };
  return shaped as LiveUsageData;
}

/**
 * The Codex agents endpoint carries each thread's *full* cwd in `project` (the
 * Claude Code one already ships a display name). AgentActivity renders `project`
 * verbatim, so shorten it to the last segment — or "Codex chat · <slug>" for the
 * desktop app's scratch folders — before it reaches the screen.
 */
export function toDisplayAgents(data: LiveSubagents | null): LiveSubagents | null {
  if (!data) return null;
  return {
    ...data,
    mainAgents: data.mainAgents.map((m) => ({ ...m, project: codexProjectLabel(m.project) })),
    running: data.running.map((r) => ({ ...r, project: codexProjectLabel(r.project) })),
    recentlyCompleted: data.recentlyCompleted.map((r) => ({ ...r, project: codexProjectLabel(r.project) })),
  };
}

/** Error strings containing "expired" mean the local Codex token lapsed (see server/codex-live.ts). */
export function isTokenExpired(err: string): boolean {
  return /expired/i.test(err);
}

/** "plus" → "Plus"; null → "—". */
export function planLabel(planType: string | null): string {
  if (!planType) return '—';
  return planType.charAt(0).toUpperCase() + planType.slice(1).replace(/_/g, ' ');
}

/** Footnote for a passive (rollout-snapshot) reading of the limits. */
export function snapshotNote(live: CodexLiveData): string {
  const at = live.snapshotAt ? Date.parse(live.snapshotAt) : NaN;
  const age = Number.isNaN(at) ? 'age unknown' : ago(at);
  return `passive snapshot · ${age} — from the newest local rollout; open the ChatGPT app for live numbers`;
}

/** "1h 12m" / "4m 20s" / "45s" for a duration in seconds. */
export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Plan / credits / status cards from the live payload (no PII in any field). */
export function liveStats(live: CodexLiveData): CodexStat[] {
  const models = Object.values(live.modelAvailability ?? {});
  const modelsSub = models.length
    ? `${models.filter(Boolean).length} of ${models.length} models available`
    : undefined;

  const c = live.credits;
  const creditsValue = !c ? '—' : c.unlimited ? 'Unlimited' : c.hasCredits ? (c.balance ?? 'Available') : 'None';
  const creditsSub = !c
    ? 'not reported'
    : c.overageLimitReached
      ? 'overage limit reached'
      : c.hasCredits || c.unlimited
        ? 'pay-as-you-go beyond the plan'
        : 'usage pauses at the plan limit';

  const rc = live.resetCredits;
  const originSub =
    live.origin === 'live'
      ? 'live · ChatGPT usage API'
      : live.snapshotAt
        ? `snapshot · ${ago(Date.parse(live.snapshotAt))}`
        : 'passive snapshot';

  return [
    {
      key: 'plan',
      label: 'Plan',
      value: planLabel(live.planType),
      sub: modelsSub,
      help: "Your ChatGPT plan as reported by OpenAI's usage API (or, offline, the newest local rollout snapshot). Model availability counts the models the plan can currently run.",
    },
    {
      key: 'credits',
      label: 'Credits',
      value: creditsValue,
      sub: creditsSub,
      accent: c?.overageLimitReached ? '#ef4444' : undefined,
      help: 'Purchased credits that keep Codex running once the plan windows are exhausted. "None" means usage pauses at the limit until the window resets.',
    },
    {
      key: 'reset-credits',
      label: 'Reset credits',
      value: rc ? String(rc.available) : '—',
      sub: rc ? `${rc.applicable} applicable now` : 'not offered on this plan',
      help: "OpenAI's rate-limit reset credits: how many the account holds vs how many could be applied to the current window.",
    },
    {
      key: 'status',
      label: 'Limit status',
      value: live.limitReached ? 'Limit reached' : 'Within limits',
      sub: originSub,
      accent: live.limitReached ? '#ef4444' : undefined,
      help: 'Whether a plan window is currently exhausted. "Live" numbers come straight from the usage API; a snapshot is the last rate-limit record Codex wrote locally.',
    },
  ];
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
