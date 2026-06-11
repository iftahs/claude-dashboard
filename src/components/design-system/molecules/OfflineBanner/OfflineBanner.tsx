import { useState } from 'react';
import type { OfflineBannerProps } from './types';

export function OfflineBanner({ error }: OfflineBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isExpired = error.toLowerCase().includes('expired');
  const isNoToken = error.toLowerCase().includes('no access token');

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm">
      <span className="text-xl mt-0.5 shrink-0">{isExpired ? '🔑' : '📡'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-300">
          {isExpired || isNoToken
            ? 'Claude.ai session expired'
            : 'Claude.ai connection offline'}
        </p>
        <p className="text-amber-300/70 text-xs mt-0.5 font-sans leading-relaxed">
          {isExpired || isNoToken ? (
            <>
              Token needs a refresh — just run Claude Code in your terminal and it refreshes automatically.
              <br />
              <span className="font-mono text-amber-400 mt-1.5 inline-block">
                # macOS Terminal / Linux / Windows:
              </span>
              <br />
              <code className="font-mono text-amber-200 bg-amber-500/10 px-1.5 py-0.5 rounded">claude</code>
              <span className="text-amber-400 mx-2">&nbsp;or&nbsp;</span>
              <code className="font-mono text-amber-200 bg-amber-500/10 px-1.5 py-0.5 rounded">claude --help</code>
            </>
          ) : (
            <>
              {error}{' '}
              <span className="text-amber-400 font-semibold">
                — try running <code className="font-mono bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-200">claude</code> in a terminal.
              </span>
            </>
          )}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500/50 hover:text-amber-300 transition-colors text-lg leading-none shrink-0 mt-0.5"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
