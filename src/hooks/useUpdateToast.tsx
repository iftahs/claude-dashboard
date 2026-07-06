import { useEffect, useState } from 'react';
import { useNotifications } from './useNotifications';
import type { VersionInfo } from '../types';

const DISMISS_KEY = 'claude-dashboard-update-dismissed';
type PullStatus = 'idle' | 'running' | 'done' | 'error';

/** Monospace command block — renders shell commands so they read as code,
 *  with a copy-to-clipboard button. */
function CodeBlock({ lines }: { lines: string[] }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(lines.join('\n'))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };
  return (
    <div className="relative mt-1.5">
      <pre className="overflow-x-auto rounded-md bg-black/40 py-1.5 pl-2.5 pr-12 font-mono text-[11px] leading-relaxed text-zinc-200 ring-1 ring-white/10">
        <code>{lines.join('\n')}</code>
      </pre>
      <button
        onClick={copy}
        title="Copy to clipboard"
        className="absolute right-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-zinc-200"
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}

/** Real clickable changelog link. */
function ChangelogLink({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-block text-blue-400 underline underline-offset-2 hover:text-blue-300"
    >
      View changelog →
    </a>
  );
}

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
        content: (
          <>
            <p>Running in Docker — pull latest and rebuild:</p>
            <CodeBlock lines={['git checkout main', 'git pull', 'npm run docker:up']} />
            <ChangelogLink url={data.changelogUrl} />
          </>
        ),
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
        content: (
          <>
            <p>Run it manually:</p>
            <CodeBlock lines={['git checkout main', 'git pull', 'npm install']} />
            <ChangelogLink url={data.changelogUrl} />
          </>
        ),
        onDismiss,
      });
    } else {
      notify({
        id: 'update',
        severity: 'info',
        title: `Update available — v${data.current} → v${data.latest}`,
        content: <ChangelogLink url={data.changelogUrl} />,
        action: { label: pull === 'running' ? 'Updating…' : 'Update now', onClick: runUpdate },
        onDismiss,
      });
    }
  }, [data, pull, notify]);
}
