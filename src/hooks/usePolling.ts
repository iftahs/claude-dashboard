import { useEffect, useRef, useState } from 'react';
import type { Envelope } from '../types';

interface State<T> {
  data: T | null;
  computedAt: number | null;
  claudeDir: string | null;
  error: string | null;
  loading: boolean;
}

/** Full return shape of usePolling — exported so contexts can type a poll slot. */
export type PollState<T> = State<T> & { lastFetch: number };

interface Cached {
  data: unknown;
  computedAt: number | null;
  claudeDir: string | null;
}

// Module-level stale-while-revalidate cache, keyed by URL. Lets the UI re-show a
// previously fetched response instantly when the user switches back to it (e.g.
// flipping the source filter Code↔Cowork), instead of clearing to a skeleton and
// waiting on a fresh round-trip every time. The background fetch still runs to
// refresh the data. Keys are a finite set of API URLs, so the map stays small.
const cache = new Map<string, Cached>();

export function usePolling<T>(url: string, intervalMs = 5000): PollState<T> {
  const [state, setState] = useState<State<T>>(() => {
    const hit = cache.get(url);
    return hit
      ? { data: hit.data as T, computedAt: hit.computedAt, claudeDir: hit.claudeDir, error: null, loading: false }
      : { data: null, computedAt: null, claudeDir: null, error: null, loading: true };
  });
  const [lastFetch, setLastFetch] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    // An empty URL means "disabled" (e.g. a feature-gated poll): make no request,
    // settle to an idle/empty state, and skip the interval entirely.
    if (!url) {
      setState({ data: null, computedAt: null, claudeDir: null, error: null, loading: false });
      return;
    }
    // On URL change (source/range filter switch): if we already have a cached
    // response for this exact URL, show it immediately (no skeleton) and revalidate
    // in the background. Otherwise clear to a skeleton until the first response lands.
    // Interval re-ticks reuse the same URL, so this never flashes on a normal poll.
    const hit = cache.get(url);
    if (hit) {
      setState({ data: hit.data as T, computedAt: hit.computedAt, claudeDir: hit.claudeDir, error: null, loading: false });
    } else {
      setState({ data: null, computedAt: null, claudeDir: null, error: null, loading: true });
    }

    async function tick() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const env: Envelope<T> = await res.json();
        cache.set(url, { data: env.data, computedAt: env.computedAt, claudeDir: env.claudeDir });
        if (!alive.current) return;
        setState({
          data: env.data,
          computedAt: env.computedAt,
          claudeDir: env.claudeDir,
          error: null,
          loading: false,
        });
        setLastFetch(Date.now());
      } catch (e) {
        if (!alive.current) return;
        // Keep any cached/last data on screen; just surface the error.
        setState((s) => ({ ...s, error: String(e), loading: false }));
        setLastFetch(Date.now());
      }
    }
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [url, intervalMs]);

  return { ...state, lastFetch };
}
