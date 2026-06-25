import { useEffect, useRef } from 'react';
import { track, setUserContext } from '../lib/analytics';
import { useNotifications } from './useNotifications';
import { useUpdateToast } from './useUpdateToast';
import { useConfigMode } from './useConfigMode';
import { useLiveData } from './useLiveData';

/**
 * App-level side effects: anonymous analytics + the toast notifications that
 * replaced the old inline banners (update available, Claude.ai offline/expired,
 * pay-as-you-go note). Kept out of the render tree so App stays a thin shell.
 */
export function useDashboardNotifications(activeTab: string) {
  const { configData, effectiveMode, isApi } = useConfigMode();
  const { liveUsage, version } = useLiveData();
  const { notify, dismiss } = useNotifications();
  useUpdateToast(version.data);

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
    notify({
      id: 'offline',
      severity: 'warning',
      title: expired ? 'Claude.ai session expired' : 'Claude.ai connection offline',
      message: expired
        ? 'Token needs a refresh — run `claude` in your terminal and it refreshes automatically.'
        : `${err} — try running \`claude\` in a terminal.`,
    });
  }, [isApi, liveUsage.data?.error, notify, dismiss]);

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
