import { useState } from 'react';

/**
 * Neutral pay-as-you-go notice shown in API mode in place of the subscription
 * "session expired" banner — there is no Claude.ai session to refresh, and the
 * dollar figures shown around the dashboard are estimates from local logs.
 */
export function ApiModeNote() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-ink-700/40 px-4 py-3 text-sm">
      <span className="mt-0.5 shrink-0 text-xl">🧾</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-zinc-200">API · pay-as-you-go</p>
        <p className="mt-0.5 font-sans text-xs leading-relaxed text-zinc-400">
          No Claude.ai subscription detected, so usage is shown as estimated cost. Dollar figures are
          computed from your local logs at Anthropic's published API rates — set spending caps in{' '}
          <span className="font-mono text-zinc-300">⚙ Settings</span>.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-lg leading-none text-zinc-500 transition-colors hover:text-zinc-300"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
