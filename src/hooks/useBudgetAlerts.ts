import { useEffect, useMemo, useRef } from 'react';
import type { Settings } from './useSettings';
import { usePolling } from './usePolling';
import { useSource } from './useSource';
import { useLiveData } from './useLiveData';
import { useConfigMode } from './useConfigMode';
import { useCostMetrics } from './useCostMetrics';
import { useLiteLlmActual } from './useLiteLlmActual';
import { hasCaps, usePlatformLimits, type CapPlatform } from './useLimits';
import { buildBudgetRows, type BudgetPeriod } from '@/lib/budget';
import { coverageDays } from '@/lib/coverage';
import { isFiniteNumber, readAlertMemory, writeAlertMemory } from '@/lib/alert-memory';
import type { WeeklyData } from '@/types';

const THRESHOLDS = [70, 90, 100] as const;

const FIRED_KEY = 'claude-dashboard-budget-alerts-fired';

interface Fired {
  window: number;
  level: number;
}

function isFired(v: unknown): v is Fired {
  const o = v as Partial<Fired> | null;
  return !!o && typeof o === 'object' && isFiniteNumber(o.window) && isFiniteNumber(o.level);
}

/** The 7-day window the budget rows need; alerts are not a 5 s concern, so a separate poll runs at 30 s. */
const WEEKLY_7D = '/api/usage/weekly?days=7';
const SCOPED_POLL_MS = 30_000;

/** Short WebAudio chime — no asset needed. Best-effort; silent on failure.
 *  (Mirrors useAgentAlerts' chime; kept local so each alert hook is self-contained.) */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    osc.onended = () => ctx.close();
  } catch {
    /* audio unavailable — ignore */
  }
}

const TITLES: Record<BudgetPeriod['key'], string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
};

const PLATFORM_NAME: Record<CapPlatform, string> = { claude: 'Claude', codex: 'Codex' };

/** One platform's budget rows, tagged for the notification copy and dedupe. */
interface PlatformRows {
  platform: CapPlatform;
  rows: BudgetPeriod[];
}

// Evaluated PER PLATFORM (Claude vs Codex caps), independent of the header switcher; fired state persists across reloads and tabs like useLimitAlerts'.
export function useBudgetAlerts(mode: Settings['budgetAlert']) {
  const [caps] = usePlatformLimits();
  const { effectiveSource, codexAvailable, sourcesLoaded, sourcesError } = useSource();
  const { liveWeekly } = useLiveData();
  const { weekStart } = useConfigMode();
  const { costPerDay } = useCostMetrics();
  const { litellmActual } = useLiteLlmActual();

  const on = mode !== 'off';
  const claudeCapped = on && hasCaps(caps.claude);
  const codexCapped = on && codexAvailable && hasCaps(caps.codex);
  // Reuse liveWeekly/weekly instead of polling twice; until /api/sources answers, the unscoped poll may still include Codex spend.
  const claudeInView = sourcesLoaded && (effectiveSource === 'claude' || (!codexAvailable && effectiveSource === null));
  const codexInView = effectiveSource === 'codex';

  const claudePoll = usePolling<WeeklyData>(claudeCapped && !claudeInView ? `${WEEKLY_7D}&source=claude` : '', SCOPED_POLL_MS);
  const codexPoll = usePolling<WeeklyData>(codexCapped && !codexInView ? `${WEEKLY_7D}&source=codex` : '', SCOPED_POLL_MS);

  const perPlatform = useMemo<PlatformRows[]>(() => {
    const now = Date.now();
    const out: PlatformRows[] = [];
    const rowsFor = (platform: CapPlatform, weekly: WeeklyData | null, inView: boolean) => {
      const limits = platform === 'claude' ? caps.claude : caps.codex;
      if (!limits || !weekly) return;
      out.push({
        platform,
        rows: buildBudgetRows({
          limits,
          buckets: weekly.buckets,
          // In view: the Trends-window average, exactly as before; otherwise the 7-day one.
          costPerDay: inView ? costPerDay : weekly.totals.cost / coverageDays(weekly, 7, now),
          weekStart,
          // The LiteLLM gateway bills Anthropic spend — it can only stand in for Claude's rows.
          actual: platform === 'claude' ? litellmActual ?? null : null,
          now,
        }),
      });
    };
    if (claudeCapped) rowsFor('claude', claudeInView ? liveWeekly.data : claudePoll.data, claudeInView);
    if (codexCapped) rowsFor('codex', codexInView ? liveWeekly.data : codexPoll.data, codexInView);
    return out;
  }, [
    caps, claudeCapped, codexCapped, claudeInView, codexInView, liveWeekly.data, claudePoll.data, codexPoll.data,
    costPerDay, weekStart, litellmActual,
  ]);

  // `${platform}:${period}` → { window: resetsAt of the window we last alerted in, level: highest threshold fired }
  const fired = useRef<Record<string, Fired> | null>(null);

  useEffect(() => {
    if (mode === 'off') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') void Notification.requestPermission();
  }, [mode]);

  useEffect(() => {
    if (mode === 'off') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    // The wording names the platform only once we know Codex exists; a failing /api/sources still alerts.
    if (!sourcesLoaded && !sourcesError) return;
    const state = (fired.current ??= readAlertMemory(FIRED_KEY, isFired));
    let changed = false;

    for (const { platform, rows } of perPlatform) {
      // Claude-only installs keep the original wording; with Codex the platform is named.
      const who = codexAvailable ? `${PLATFORM_NAME[platform]} ` : '';
      for (const r of rows) {
        if (r.pct == null) continue; // no cap configured

        const id = `${platform}:${r.key}`;
        const prev = state[id];
        // Reset the high-water mark when this period rolls into a new window.
        let level = prev && prev.window === r.resetsAt ? prev.level : 0;
        const nextThreshold = THRESHOLDS.find((t) => t > level);
        if (nextThreshold !== undefined && r.pct >= nextThreshold) {
          const other = readAlertMemory(FIRED_KEY, isFired)[id];
          if (other && other.window === r.resetsAt) level = Math.max(level, other.level); // another tab already alerted
        }

        for (const t of THRESHOLDS) {
          if (r.pct >= t && level < t) {
            level = t;
            const title = `${TITLES[r.key]} budget`;
            new Notification(
              t === 100 ? `${who}${who ? title.toLowerCase() : title} reached` : `${who}${who ? title.toLowerCase() : title} at ${t}%`,
              {
                body:
                  t === 100
                    ? `You've hit your ${who}${r.key} spend cap of $${r.cap}.`
                    : `You've used ${Math.round(r.pct)}% of your ${who}${r.key} spend cap.`,
                icon: '/favicon.ico',
                tag: `${platform}-budget-${r.key}`,
              },
            );
            if (mode === 'sound') playChime();
          }
        }

        if (!prev || prev.window !== r.resetsAt || level !== prev.level) {
          state[id] = { window: r.resetsAt, level };
          changed = true;
        }
      }
    }
    if (changed) writeAlertMemory(FIRED_KEY, state);
  }, [perPlatform, mode, codexAvailable, sourcesLoaded, sourcesError]);
}
