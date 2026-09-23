import { useEffect } from 'react';
import { TranscriptTurn } from '../TranscriptTurn/TranscriptTurn';
import type { TranscriptPaneProps } from './types';

/** The lazily fetched transcript of one session (Claude transcript or Codex rollout — same shape). */
export function TranscriptPane({ sessionId, onFetch, state }: TranscriptPaneProps) {
  useEffect(() => {
    onFetch(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (!state || state.loading) {
    return (
      <div className="py-4 flex items-center gap-2 text-xs text-zinc-600">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-700 animate-pulse" />
        Loading transcript…
      </div>
    );
  }
  if (state.error) {
    return <div className="py-4 text-xs text-red-400">Failed to load transcript: {state.error}</div>;
  }
  if (!state.data) return null;

  const { turns, truncated, totalTurns, archived, message } = state.data;

  if (archived) {
    return (
      <div className="mt-2 text-xs text-zinc-500 bg-ink-700/40 border border-white/10 rounded-lg px-3 py-2">
        {message ?? 'This transcript is no longer on disk; only its usage history is kept.'}
      </div>
    );
  }
  if (turns.length === 0) {
    return <div className="py-4 text-xs italic text-zinc-600">No messages recorded for this session.</div>;
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      {truncated && (
        <div className="text-xs text-amber-400/70 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-1.5">
          Long session — middle messages omitted. Showing {turns.length} of {totalTurns} messages.
        </div>
      )}
      {turns.map((turn, i) => (
        <TranscriptTurn key={i} turn={turn} />
      ))}
    </div>
  );
}
