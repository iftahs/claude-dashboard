import { useEffect, useState } from 'react';
import { useNotifications } from './useNotifications';
import type { VersionInfo } from '../types';

const DISMISS_KEY = 'claude-dashboard-update-dismissed';
type PullStatus = 'idle' | 'running' | 'done' | 'error';

/**
 * Drives the "update available" toast (replaces the old inline UpdateBanner).
 * Keeps the dev-only self-update progress state and the per-version dismissal
 * that the banner used to own. Docker users get manual instructions instead of
 * an action button (they can't git-pull from inside the container).
 */
export function useUpdateToast(data: VersionInfo | null | undefined) {
  const { notify } = useNotifications();
  const [pull, setPull] = useState<PullStatus>('idle');

  useEffect(() => {
    if (!data || !data.updateAvailable) return;
    let dismissedVersion: string | null = null;
    try {
      dismissedVersion = localStorage.getItem(DISMISS_KEY);
    } catch {
      /* storage disabled (private mode / sandboxed) — show the toast anyway */
    }
    if (dismissedVersion === data.latest) return;

    const onDismiss = () => {
      try {
        if (data.latest) localStorage.setItem(DISMISS_KEY, data.latest);
      } catch {
        /* ignore */
      }
    };

    async function runUpdate() {
      setPull('running');
      try {
        const res = await fetch('/api/update/pull', { method: 'POST' });
        const body = await res.json();
        setPull(body.ok ? 'done' : 'error');
      } catch {
        setPull('error');
      }
    }

    if (data.isDocker) {
      notify({
        id: 'update',
        severity: 'info',
        title: `Update available — v${data.current} → v${data.latest}`,
        message: `Running in Docker — pull latest and rebuild:\ngit pull\nnpm run docker:up\n\nChangelog: ${data.changelogUrl}`,
        onDismiss,
      });
    } else if (pull === 'done') {
      notify({
        id: 'update',
        severity: 'info',
        title: '✓ Pulled latest code',
        message: 'Reload the page to apply the update.',
        action: { label: 'Reload page', onClick: () => location.reload() },
        onDismiss,
      });
    } else if (pull === 'error') {
      notify({
        id: 'update',
        severity: 'warning',
        title: 'Auto-update failed',
        message: `Run it manually:\ngit pull\nnpm install\n\nChangelog: ${data.changelogUrl}`,
        onDismiss,
      });
    } else {
      notify({
        id: 'update',
        severity: 'info',
        title: `Update available — v${data.current} → v${data.latest}`,
        message: `Changelog: ${data.changelogUrl}`,
        action: { label: pull === 'running' ? 'Updating…' : 'Update now', onClick: runUpdate },
        onDismiss,
      });
    }
  }, [data, pull, notify]);
}
