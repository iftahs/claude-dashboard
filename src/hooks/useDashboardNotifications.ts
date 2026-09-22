import { useEffect, useMemo, useRef } from 'react';
import { track, setUserContext } from '../lib/analytics';
import { buildBudgetRows } from '../lib/budget';
import { useNotifications } from './useNotifications';
import { useUpdateToast } from './useUpdateToast';
import { useConfigMode } from './useConfigMode';
import { useSource } from './useSource';
import { useLiveData } from './useLiveData';
import { useLiteLlmActual } from './useLiteLlmActual';
import { useCostMetrics } from './useCostMetrics';
import { useAgentTraffic } from './useAgentTraffic';
import { useAgentAlerts } from './useAgentAlerts';
import { useBudgetAlerts } from './useBudgetAlerts';
import type { Limits } from './useLimits';

/**
 * App-level side effects: anonymous analytics + the toast notifications that
 * replaced the old inline banners (update available, Claude.ai offline/expired,
 * pay-as-you-go note). Kept out of the render tree so App stays a thin shell.
 */
export function useDashboardNotifications(activeTab: string, limits: Limits) {
  const { configData, detectedMode, effectiveMode, isApi, settings, weekStart } = useConfigMode();
  const { platform } = useSource();
  const { liveUsage, version, weekly } = useLiveData();
  const { litellmActual } = useLiteLlmActual();
  const { costPerDay } = useCostMetrics();
  const { notify, dismiss } = useNotifications();
  const { waiting } = useAgentTraffic();
  useUpdateToast(version.data);
  // Alert (per Settings) when a new agent turns red / needs attention.
  useAgentAlerts(waiting, settings.agentAlert);

  // Soft (non-blocking) budget alerts (LiteLLM-inspired) — fire app-wide, not
  // just on the Live tab, the first time spend crosses a cap threshold.
  const budgetRows = useMemo(
    () =>
      buildBudgetRows({
        limits,
        buckets: weekly.data?.buckets,
        costPerDay,
        weekStart,
        actual: litellmActual ?? null,
        now: Date.now(),
      }),
    [limits, weekly.data?.buckets, costPerDay, weekStart, litellmActual],
  );
  useBudgetAlerts(budgetRows, settings.budgetAlert);

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
    // Nothing on screen is Claude.ai's while the platform switcher is on Codex —
    // an Anthropic token the user isn't currently using must not raise a toast.
    if (!err || platform === 'codex') {
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
    notify({
      id: 'offline',
      severity: 'warning',
      title: expired ? 'Claude.ai session expired'
        : upstream ? 'Claude.ai service unavailable'
        : 'Claude.ai connection offline',
      message: expired
        // The server's message is runtime-aware (host vs Docker) — relay it.
        ? err
        : upstream
        ? `Anthropic's usage service is temporarily unavailable (${err.match(/5\d\d/)?.[0] ?? '5xx'}). It's on their side — the dashboard keeps retrying and this clears on its own.`
        : `${err} — try running \`claude\` in a terminal.`,
    });
  }, [isApi, detectedMode, platform, liveUsage.data?.error, notify, dismiss]);

  // Pay-as-you-go note — shown once per session when API mode is active.
  const apiNotified = useRef(false);
  useEffect(() => {
    if (isApi && configData && !apiNotified.current) {
      apiNotified.current = true;
      notify({
        id: 'api-mode',
        severity: 'info',
        timeoutMs: 9000,
        title: 'API · pay-as-you-go',
        message:
          "No Claude.ai subscription detected — dollar figures are estimated from local logs at Anthropic's API rates. Set spending caps in ⚙ Settings.",
      });
    }
  }, [isApi, configData, notify]);
}
