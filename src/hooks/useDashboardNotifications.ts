import { useEffect, useMemo, useRef } from 'react';
import { track, setUserContext } from '../lib/analytics';
import { buildBudgetRows } from '../lib/budget';
import { useNotifications } from './useNotifications';
import { useUpdateToast } from './useUpdateToast';
import { useConfigMode } from './useConfigMode';
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
  const { configData, effectiveMode, isApi, settings, weekStart } = useConfigMode();
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
  useEffect(() => {
    if (configData) setUserContext({ plan: configData.subscriptionType, usageMode: effectiveMode });
  }, [configData, effectiveMode]);

  // Claude.ai offline / expired token (subscription mode only). Reactive: shows
  // while the live API reports an error, auto-clears when it recovers.
  useEffect(() => {
    const err = !isApi ? liveUsage.data?.error : undefined;
    if (!err) {
      dismiss('offline');
      return;
    }
    const lc = err.toLowerCase();
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
        ? 'Token needs a refresh — run `claude` in your terminal and it refreshes automatically.'
        : upstream
        ? `Anthropic's usage service is temporarily unavailable (${err.match(/5\d\d/)?.[0] ?? '5xx'}). It's on their side — the dashboard keeps retrying and this clears on its own.`
        : `${err} — try running \`claude\` in a terminal.`,
    });
  }, [isApi, liveUsage.data?.error, notify, dismiss]);

  // Auto-resume completion — toast when a scheduled resume finishes, so the
  // result is noticed without reopening the session (details on ⏰ Auto-Resume).
  const lastResumeKey = useRef<string | null>(null);
  const { autoResume } = useLiveData();
  useEffect(() => {
    const top = autoResume.data?.history?.[0];
    if (!top || top.status === 'cancelled') return;
    const key = `${top.id}:${top.finishedAt}`;
    if (lastResumeKey.current === null) {
      lastResumeKey.current = key; // don't re-announce history from before this page load
      return;
    }
    if (lastResumeKey.current === key) return;
    lastResumeKey.current = key;
    const project = top.projectPath.split(/[\\/]/).filter(Boolean).pop() || 'session';
    notify({
      id: `auto-resume:${key}`,
      severity: top.status === 'done' ? 'info' : 'warning',
      timeoutMs: top.status === 'done' ? 12000 : 0,
      title:
        top.status === 'done'
          ? `Auto-resumed ${project}`
          : top.status === 'skipped'
            ? `Auto-resume skipped for ${project}`
            : `Auto-resume failed for ${project}`,
      message:
        top.status === 'done'
          ? 'The interrupted work was continued. See the output on the ⏰ Auto-Resume page.'
          : top.status === 'skipped'
            ? 'The session was already continued manually before the scheduled time.'
            : `${(top.message || 'unknown error').slice(0, 200)} — details on the ⏰ Auto-Resume page.`,
    });
  }, [autoResume.data?.history, notify]);

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
