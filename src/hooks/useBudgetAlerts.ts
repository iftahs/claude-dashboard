import { useEffect, useRef } from 'react';
import type { Settings } from './useSettings';
import type { BudgetPeriod } from '@/lib/budget';

const THRESHOLDS = [70, 90, 100] as const;

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

/**
 * Soft (non-blocking) budget alerts — LiteLLM-inspired. Fires a browser
 * notification (and optional chime) the first time spend crosses 70 / 90 / 100%
 * of a cap, deduped per period per calendar window: each threshold fires once,
 * and tracking resets when the period rolls over (a new resetsAt). 'off' is a
 * no-op. Mirrors useBlockAlerts' permission-request pattern.
 */
export function useBudgetAlerts(rows: BudgetPeriod[], mode: Settings['budgetAlert']) {
  // key → { window: resetsAt of the window we last alerted in, level: highest threshold fired }
  const fired = useRef<Record<string, { window: number; level: number }>>({});

  useEffect(() => {
    if (mode === 'off') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') void Notification.requestPermission();
  }, [mode]);

  useEffect(() => {
    if (mode === 'off') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    for (const r of rows) {
      if (r.pct == null) continue; // no cap configured

      const prev = fired.current[r.key];
      // Reset the high-water mark when this period rolls into a new window.
      const baseLevel = prev && prev.window === r.resetsAt ? prev.level : 0;
      let level = baseLevel;

      for (const t of THRESHOLDS) {
        if (r.pct >= t && level < t) {
          level = t;
          new Notification(
            t === 100 ? `${TITLES[r.key]} budget reached` : `${TITLES[r.key]} budget at ${t}%`,
            {
              body:
                t === 100
                  ? `You've hit your ${r.key} spend cap of $${r.cap}.`
                  : `You've used ${Math.round(r.pct)}% of your ${r.key} spend cap.`,
              icon: '/favicon.ico',
              tag: `claude-budget-${r.key}`,
            },
          );
          if (mode === 'sound') playChime();
        }
      }

      if (!prev || prev.window !== r.resetsAt || level !== prev.level) {
        fired.current[r.key] = { window: r.resetsAt, level };
      }
    }
  }, [rows, mode]);
}
