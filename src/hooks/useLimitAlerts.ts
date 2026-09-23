import { useEffect, useMemo, useRef } from 'react';
import { untilFull } from '../lib/format';
import { limitReadings, resolveLimitAlerts, type LimitReading } from '../lib/limits';
import { isFiniteNumber, readAlertMemory, writeAlertMemory } from '../lib/alert-memory';
import { useConfigMode } from './useConfigMode';
import { useLiveData } from './useLiveData';

// Short WebAudio chime — no asset needed; kept local like the other alert hooks' chimes so each stays self-contained.
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
    osc.frequency.value = 520;
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

const FIRED_KEY = 'claude-dashboard-limit-alerts-fired';

interface Fired {
  resetsAt: number | null;
  level: number;
}

function isFired(v: unknown): v is Fired {
  const o = v as Partial<Fired> | null;
  return !!o && typeof o === 'object' && isFiniteNumber(o.level) && (o.resetsAt === null || isFiniteNumber(o.resetsAt));
}

/** A new window has a reset at least one window-length later; half of that tolerates API jitter. */
function sameWindow(a: number | null, b: number | null, windowMs: number): boolean {
  return a === null || b === null || Math.abs(a - b) < windowMs / 2;
}

function message(r: LimitReading, level: number): { title: string; body: string } {
  const resets = r.resetsAt !== null ? ` Resets in ${untilFull(r.resetsAt)}.` : '';
  if (level >= 100) {
    return { title: `${r.platform} ${r.label} reached`, body: `Usage pauses until the window resets.${resets}` };
  }
  return {
    title: `${r.platform} ${r.label} at ${level}%`,
    body: level >= 90
      ? `Nearly at the limit — slow down to avoid hitting the cap.${resets}`
      : `You've used ${Math.round(r.pct)}% of your ${r.label}.${resets}`,
  };
}

// App-wide alerts for every provider window (Claude + Codex, 5h + weekly), regardless of tab or header; each threshold fires once per window (localStorage-deduped across reloads/tabs).
export function useLimitAlerts() {
  const { liveUsage, codexLive } = useLiveData();
  const { isApi, settings } = useConfigMode();
  const config = resolveLimitAlerts((settings as { limitAlerts?: unknown }).limitAlerts);
  const thresholdKey = config.thresholds.join(',');
  const fired = useRef<Record<string, Fired> | null>(null);

  const readings = useMemo(
    () => limitReadings(isApi ? null : liveUsage.data, codexLive.data),
    [isApi, liveUsage.data, codexLive.data],
  );

  useEffect(() => {
    if (config.mode === 'off') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') void Notification.requestPermission();
  }, [config.mode]);

  useEffect(() => {
    if (config.mode === 'off') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const levels = [...config.thresholds, 100];
    const rearmBelow = Math.max(0, config.thresholds[0] - 20);
    const state = (fired.current ??= readAlertMemory(FIRED_KEY, isFired));
    let changed = false;

    for (const r of readings) {
      const prev = state[r.key];
      let level = prev && sameWindow(prev.resetsAt, r.resetsAt, r.windowMs) ? prev.level : 0;
      if (r.pct < rearmBelow) level = 0;
      const pct = r.reached ? 100 : r.pct;
      // Only the highest newly crossed threshold alerts (opening at 95% says "90%", not "70%" and "90%").
      const crossed = levels.filter((t) => pct >= t && level < t).pop();
      if (crossed !== undefined) {
        const other = readAlertMemory(FIRED_KEY, isFired)[r.key];
        if (other && sameWindow(other.resetsAt, r.resetsAt, r.windowMs) && other.level >= crossed) {
          level = other.level; // another tab already alerted
        } else {
          level = crossed;
          const { title, body } = message(r, crossed);
          new Notification(title, { body, icon: '/favicon.ico', tag: `${r.key}-${crossed}` });
          if (config.mode === 'sound') playChime();
        }
      }
      const next = { resetsAt: r.resetsAt ?? prev?.resetsAt ?? null, level };
      if (!prev || prev.level !== next.level || prev.resetsAt !== next.resetsAt) {
        state[r.key] = next;
        changed = true;
      }
    }
    if (changed) writeAlertMemory(FIRED_KEY, state);
    // thresholdKey stands in for config.thresholds, a new array every render.
  }, [readings, config.mode, thresholdKey]);
}
