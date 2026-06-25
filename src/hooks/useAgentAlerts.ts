import { useEffect, useRef } from 'react';
import type { Settings } from './useSettings';

/** Short WebAudio chime — no asset needed. Best-effort; silent on failure. */
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
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

/**
 * Fires an alert when the number of agents waiting for the user RISES (a new
 * agent needs attention). The red badge is always shown by the UI; this adds a
 * browser notification and/or chime per the user's Settings choice. 'visual'
 * mode is a no-op here. Mirrors useBlockAlerts' permission-request pattern.
 */
export function useAgentAlerts(waitingCount: number, mode: Settings['agentAlert']) {
  const prev = useRef(0);

  useEffect(() => {
    if (mode === 'visual') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, [mode]);

  useEffect(() => {
    const rose = waitingCount > prev.current;
    prev.current = waitingCount;
    if (mode === 'visual' || !rose || waitingCount === 0) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Agent needs your attention', {
        body:
          waitingCount === 1
            ? 'An agent is waiting for your confirmation.'
            : `${waitingCount} agents are waiting for your confirmation.`,
        icon: '/favicon.ico',
        tag: 'agent-waiting',
      });
    }
    if (mode === 'sound') playChime();
  }, [waitingCount, mode]);
}
