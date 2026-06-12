import { useState } from 'react';
import type { UpdateBannerProps } from './types';

const DISMISS_KEY = 'claude-dashboard-update-dismissed';
type PullStatus = 'idle' | 'running' | 'done' | 'error';

/**
 * Copyable command chip. Takes the steps as separate commands and renders one
 * per line — never joined with `&&`, which is a parse error in Windows
 * PowerShell 5.1. Copying yields newline-separated commands, which run
 * sequentially in cmd, PowerShell, and POSIX shells alike.
 */
function CommandChip({ cmds }: { cmds: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-start gap-2 align-top">
      <code className="font-mono text-amber-200 bg-amber-500/10 px-1.5 py-0.5 rounded whitespace-pre-line">
        {cmds.join('\n')}
      </code>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(cmds.join('\n'));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="text-amber-400/70 hover:text-amber-300 transition-colors"
        title="Copy commands"
      >
        {copied ? '✓ copied' : '⧉ copy'}
      </button>
    </span>
  );
}

export function UpdateBanner({ data }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(
    () => !!data && localStorage.getItem(DISMISS_KEY) === data.latest,
  );
  const [pull, setPull] = useState<PullStatus>('idle');
  const [pullMsg, setPullMsg] = useState('');

  if (!data || !data.updateAvailable || dismissed) return null;

  function dismiss() {
    if (data?.latest) localStorage.setItem(DISMISS_KEY, data.latest);
    setDismissed(true);
  }

  async function runUpdate() {
    setPull('running');
    setPullMsg('');
    try {
      const res = await fetch('/api/update/pull', { method: 'POST' });
      const body = await res.json();
      if (body.ok) {
        setPull('done');
        setPullMsg(body.output || 'Updated.');
      } else {
        setPull('error');
        setPullMsg(body.error || 'Update failed.');
      }
    } catch (e) {
      setPull('error');
      setPullMsg(String(e));
    }
  }

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm">
      <span className="text-xl mt-0.5 shrink-0">🚀</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-300">
          Update available — v{data.current} → v{data.latest}{' '}
          <a
            href={data.changelogUrl}
            target="_blank"
            rel="noreferrer"
            className="font-normal text-amber-400/80 hover:text-amber-200 underline underline-offset-2"
          >
            View changelog ↗
          </a>
        </p>

        <div className="text-amber-300/70 text-xs mt-1 font-sans leading-relaxed">
          {data.isDocker ? (
            <>
              You're running in Docker. Pull the latest code and rebuild the image:
              <br />
              <span className="mt-1.5 inline-block">
                <CommandChip cmds={['git pull', 'npm run docker:up']} />
              </span>
            </>
          ) : pull === 'done' ? (
            <>
              <span className="text-emerald-400 font-semibold">✓ Pulled latest code.</span> Reload to apply.
              <br />
              <button
                onClick={() => location.reload()}
                className="mt-1.5 rounded-lg bg-amber-500/20 px-3 py-1 font-semibold text-amber-200 hover:bg-amber-500/30 transition-colors"
              >
                Reload page
              </button>
            </>
          ) : pull === 'error' ? (
            <>
              <span className="text-red-400 font-semibold">Auto-update failed.</span> Run it manually:
              <br />
              <span className="mt-1.5 inline-block">
                <CommandChip cmds={['git pull', 'npm install']} />
              </span>
              {pullMsg && <p className="mt-1 font-mono text-amber-400/60 break-all">{pullMsg}</p>}
            </>
          ) : (
            <>
              Pull the latest code automatically:
              <br />
              <button
                onClick={runUpdate}
                disabled={pull === 'running'}
                className="mt-1.5 rounded-lg bg-amber-500/20 px-3 py-1 font-semibold text-amber-200 hover:bg-amber-500/30 transition-colors disabled:opacity-60"
              >
                {pull === 'running' ? 'Updating…' : 'Update now'}
              </button>
            </>
          )}
        </div>
      </div>
      <button
        onClick={dismiss}
        className="text-amber-500/50 hover:text-amber-300 transition-colors text-lg leading-none shrink-0 mt-0.5"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
