import { useEffect, useRef } from 'react';
import { track, setUserContext } from '../lib/analytics';
import { useNotifications } from './useNotifications';
import { useUpdateToast } from './useUpdateToast';
import { useConfigMode } from './useConfigMode';
import { useSource } from './useSource';
import { useLiveData } from './useLiveData';
import { useAgentTraffic } from './useAgentTraffic';
import { useAgentAlerts } from './useAgentAlerts';
import { useBudgetAlerts } from './useBudgetAlerts';
import { useLimitAlerts } from './useLimitAlerts';
import { isTokenExpired } from '../lib/gauge';

const SIGN_IN_TOAST_MS = 12_000;
const SHOWN_PREFIX = 'claude-dashboard-toast-shown:';

// A sign-in toast shows once per browser session for a given problem; the inline callouts keep the detail on screen.
function alreadyShown(id: string, kind: string): boolean {
  try {
    if (sessionStorage.getItem(SHOWN_PREFIX + id) === kind) return true;
    sessionStorage.setItem(SHOWN_PREFIX + id, kind);
  } catch {
    /* storage blocked: show it */
  }
  return false;
}

function forgetShown(id: string): void {
  try {
    sessionStorage.removeItem(SHOWN_PREFIX + id);
  } catch {
    /* storage blocked */
  }
}

/**
 * App-level side effects: anonymous analytics + the toast notifications that
 * replaced the old inline banners (update available, Claude.ai offline/expired,
 * Codex token expired, pay-as-you-go note) + the alert hooks, each scoped to the platform it's about. Kept out of the render tree so App stays a thin shell.
 */
export function useDashboardNotifications(activeTab: string) {
  const { configData, detectedMode, effectiveMode, isApi, settings } = useConfigMode();
  const { showClaude, showCodex, sourcesLoaded } = useSource();
  const { liveUsage, version, codexLive } = useLiveData();
  const { notify, dismiss } = useNotifications();
  const { waiting } = useAgentTraffic();
  useUpdateToast(version.data);
  // Alert (per Settings) when a new agent turns red / needs attention.
  useAgentAlerts(waiting, settings.agentAlert);
  // Rate-limit alerts (Claude 5h / weekly, Codex 5h / weekly) — every tab, every platform.
  useLimitAlerts();

  // Soft (non-blocking) budget alerts (LiteLLM-inspired) — fire app-wide, not
  // just on the Live page, the first time spend crosses a cap threshold. Each platform is checked against its own caps.
  useBudgetAlerts(settings.budgetAlert);

  // ── Product analytics (anonymous, path-free events only — see lib/analytics) ──
  useEffect(() => {
    track('tab_viewed', { tab: activeTab });
  }, [activeTab]);
  // Register coarse segmentation as super-props once config loads, then emit one
  // `app_opened` per session. Because `$pageview` fires at init (before config),
  // this guarantees a plan/usage_mode-tagged event for reliable segmentation.
  const appOpenedSent = useRef(false);
  useEffect(() => {
    if (!configData) return;
    setUserContext({ plan: configData.subscriptionType, usageMode: effectiveMode });
    if (!appOpenedSent.current) {
      appOpenedSent.current = true;
      track('app_opened');
    }
  }, [configData, effectiveMode]);

  // Claude.ai offline / expired token (subscription mode only). Reactive: shows
  // while the live API reports an error, auto-clears when it recovers.
  useEffect(() => {
    const err = !isApi ? liveUsage.data?.error : undefined;
    // Recovered: the next failure is news again.
    if (liveUsage.data && !liveUsage.data.error) forgetShown('offline');
    // Nothing on screen is Claude.ai's while the platform switcher is on Codex —
    // an Anthropic token the user isn't currently using must not raise a toast.
    if (!err || !showClaude) {
      dismiss('offline');
      return;
    }
    const lc = err.toLowerCase();
    // "No access token" means there simply are no Claude.ai credentials on this
    // machine — e.g. a Codex-only user, or someone who never logged Claude Code in.
    // The backend reports that as `authMode: 'api'` (`detectedMode`), so unless the
    // user has *forced* subscription mode in Settings the toast is already skipped
    // via `isApi`; this guard covers the forced case, where nagging "session
    // expired" on every load would be wrong — there was never a session to expire.
    if (lc.includes('no access token') && detectedMode === 'api') {
      dismiss('offline');
      return;
    }
    const expired = lc.includes('expired') || lc.includes('no access token');
    // Upstream Anthropic outage (5xx) — not a token problem; running `claude` won't help.
    const upstream = /:\s*5\d\d\b/.test(err) || lc.includes('service unavailable')
      || lc.includes('bad gateway') || lc.includes('gateway timeout');
    if (alreadyShown('offline', expired ? 'expired' : upstream ? 'upstream' : 'offline')) return;
    notify({
      id: 'offline',
      severity: 'warning',
      timeoutMs: SIGN_IN_TOAST_MS,
      title: expired ? 'Claude sign-in expired'
        : upstream ? 'Claude.ai service unavailable'
        : 'Claude.ai connection offline',
      message: expired
        // The server's runtime-aware detail (host vs Docker) stays in the inline callouts.
        ? 'Run `claude` in a terminal to refresh live limits.'
        : upstream
        ? `Anthropic's usage service is temporarily unavailable (${err.match(/5\d\d/)?.[0] ?? '5xx'}). It's on their side — the dashboard keeps retrying and this clears on its own.`
        : `${err} — try running \`claude\` in a terminal.`,
    });
  }, [isApi, detectedMode, showClaude, liveUsage.data, notify, dismiss]);

  // Codex token expired/rejected — Codex counterpart of the Claude.ai toast; the ChatGPT app refreshes its own token, the dashboard never does.
  useEffect(() => {
    const err = showCodex ? codexLive.data?.error : undefined;
    if (codexLive.data && !codexLive.data.error) forgetShown('codex-offline');
    const rejected = !!err && /rejected/i.test(err);
    if (!err || !(isTokenExpired(err) || rejected)) {
      dismiss('codex-offline');
      return;
    }
    if (alreadyShown('codex-offline', rejected ? 'rejected' : 'expired')) return;
    notify({
      id: 'codex-offline',
      severity: 'warning',
      timeoutMs: SIGN_IN_TOAST_MS,
      title: rejected ? 'Codex sign-in rejected' : 'Codex sign-in expired',
      message: rejected ? 'Sign in again in the ChatGPT desktop app.' : 'Open the ChatGPT desktop app to refresh live limits.',
    });
  }, [showCodex, codexLive.data, notify, dismiss]);

  // Pay-as-you-go note — shown once per session when API mode is active and Claude is on screen; waits for /api/sources so a Codex-only user never sees it.
  const apiNotified = useRef(false);
  useEffect(() => {
    if (!showClaude) {
      dismiss('api-mode');
      return;
    }
    if (isApi && configData && sourcesLoaded && !apiNotified.current) {
      apiNotified.current = true;
      notify({
        id: 'api-mode',
        severity: 'info',
        timeoutMs: 9000,
        title: 'API · pay-as-you-go',
        message:
          "No Claude.ai subscription detected — dollar figures are estimated from local logs at Anthropic's API rates. Set spending caps in Settings.",
      });
    }
  }, [isApi, configData, showClaude, sourcesLoaded, notify, dismiss]);
}
