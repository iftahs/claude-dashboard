import { useEffect, useRef } from 'react';
import { useLiveData } from './useLiveData';
import { usePolling } from './usePolling';
import { useSource } from './useSource';
import type { Settings } from './useSettings';
import type { LiveSubagents } from '../types';

/** The hidden platform's feed only feeds this alert, so it can poll slower than the 2.5 s live view. */
const HIDDEN_POLL_MS = 10_000;

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

// "Waiting" means something different per platform, so each names its own causes rather than sharing wording.
export function agentAlertText(claude: number, codex: number): { title: string; body: string } {
  const total = claude + codex;
  const title = total === 1 ? 'Agent needs your attention' : 'Agents need your attention';
  if (codex === 0) {
    return {
      title,
      body:
        claude === 1
          ? 'A Claude Code session is waiting for you — a permission prompt, a rejected tool call or an error.'
          : `${claude} Claude Code sessions are waiting for you — permission prompts, rejected tool calls or errors.`,
    };
  }
  if (claude === 0) {
    return {
      title,
      body:
        codex === 1
          ? 'A Codex thread needs you — an approval request, a declined action or a failed turn.'
          : `${codex} Codex threads need you — approval requests, declined actions or failed turns.`,
    };
  }
  return { title, body: `${total} agents need you — ${claude} in Claude, ${codex} in Codex.` };
}

/**
 * Fires an alert when the number of agents waiting for the user RISES (a new
 * agent needs attention). The red badge is always shown by the UI; this adds a
 * browser notification and/or chime per the user's Settings choice. 'visual'
 * mode is a no-op here. Same permission-request pattern as useLimitAlerts.
 *
 * Counts cover BOTH platforms regardless of the switcher — a hidden platform is polled here and can still alert.
 */
export function useAgentAlerts(_viewWaiting: number, mode: Settings['agentAlert']) {
  const { liveSubagents, codexAgents } = useLiveData();
  const { showClaude, showCodex, codexAvailable } = useSource();
  const alertsOn = mode !== 'visual';
  const hiddenClaude = usePolling<LiveSubagents>(alertsOn && !showClaude ? '/api/subagents/live' : '', HIDDEN_POLL_MS);
  const hiddenCodex = usePolling<LiveSubagents>(
    alertsOn && codexAvailable && !showCodex ? '/api/codex/agents/live' : '',
    HIDDEN_POLL_MS,
  );
  // null = no data yet (loading, or mid-handover on a platform switch) — never read as a drop to zero, or it would re-alert an old wait.
  const claudeFeed = showClaude ? liveSubagents.data : hiddenClaude.data;
  const codexFeed = showCodex ? codexAgents.data : hiddenCodex.data;
  const claude = claudeFeed ? claudeFeed.counts.waiting : null;
  const codex = codexAvailable ? (codexFeed ? codexFeed.counts.waiting : null) : 0;

  const prev = useRef({ claude: 0, codex: 0 });

  useEffect(() => {
    if (mode === 'visual') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, [mode]);

  useEffect(() => {
    const p = prev.current;
    const c = claude ?? p.claude;
    const x = codex ?? p.codex;
    const rose = c > p.claude || x > p.codex;
    prev.current = { claude: c, codex: x };
    if (mode === 'visual' || !rose) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      const { title, body } = agentAlertText(c, x);
      new Notification(title, { body, icon: '/favicon.ico', tag: 'agent-waiting' });
    }
    if (mode === 'sound') playChime();
  }, [claude, codex, mode]);
}
