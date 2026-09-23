import { useEffect, useState } from 'react';
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
  /** Client clock when the response arrived — what "fresh enough to re-show" is measured on. */
  fetchedAt: number;
}

// Module-level stale-while-revalidate cache, keyed by URL. Lets the UI re-show a
// previously fetched response instantly when the user switches back to it (e.g.
// flipping the source filter Code↔Cowork), instead of clearing to a skeleton and
// waiting on a fresh round-trip every time. The background fetch still runs to
// refresh the data. Keys are a finite set of API URLs, so the map stays small.
// Only a response at most two poll intervals old is re-shown (see freshHit).
const cache = new Map<string, Cached>();

/**
 * The cached response for `url` when it is at most two poll intervals old, else
 * null. A poll that was switched off (the platform gating of the 2.5s agent and
 * 4s workflow polls) leaves an entry of any age behind; re-shown as current, an
 * hour-old "agent waiting" snapshot fired a false alert until the first fresh
 * response replaced it. Older than that, show the loading state instead.
 */
function freshHit(url: string, intervalMs: number): Cached | null {
  const hit = cache.get(url);
  return hit && Date.now() - hit.fetchedAt <= 2 * intervalMs ? hit : null;
}

// In-flight requests keyed by URL. Two hooks polling the same endpoint (and
// StrictMode's double-mount in dev) previously issued two identical requests that
// both occupied one of the browser's six connections per origin. They now share one.
const inflight = new Map<string, Promise<Cached>>();

/** Fetch a URL, collapsing concurrent callers onto a single request. */
function fetchShared(url: string): Promise<Cached> {
  const pending = inflight.get(url);
  if (pending) return pending;

  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const env: Envelope<unknown> = await res.json();
    const entry: Cached = { data: env.data, computedAt: env.computedAt, claudeDir: env.claudeDir, fetchedAt: Date.now() };
    // Populate the cache even when every subscriber has unmounted — a poll that
    // outlives its component still warms the next mount.
    cache.set(url, entry);
    return entry;
  })().finally(() => {
    inflight.delete(url);
  });

  inflight.set(url, p);
  return p;
}

export function usePolling<T>(url: string, intervalMs = 5000): PollState<T> {
  const [state, setState] = useState<State<T>>(() => {
    const hit = freshHit(url, intervalMs);
    return hit
      ? { data: hit.data as T, computedAt: hit.computedAt, claudeDir: hit.claudeDir, error: null, loading: false }
      : { data: null, computedAt: null, claudeDir: null, error: null, loading: true };
  });
  const [lastFetch, setLastFetch] = useState(0);

  useEffect(() => {
    // Per effect run, not a shared ref: on a URL switch (platform/range filter) a
    // fetch for the old URL can resolve after this run has started. A ref reset to
    // true here would let it through and paint the previous filter's data over the
    // new one — for up to a whole interval on the 60s polls.
    let cancelled = false;
    // An empty URL means "disabled" (e.g. a feature-gated poll): make no request,
    // settle to an idle/empty state, and skip the interval entirely.
    if (!url) {
      setState({ data: null, computedAt: null, claudeDir: null, error: null, loading: false });
      return;
    }
    // On URL change (source/range filter switch): if we already have a recent cached
    // response for this exact URL, show it immediately (no skeleton) and revalidate
    // in the background. Otherwise clear to a skeleton until the first response lands.
    // Interval re-ticks reuse the same URL, so this never flashes on a normal poll.
    const hit = freshHit(url, intervalMs);
    if (hit) {
      setState({ data: hit.data as T, computedAt: hit.computedAt, claudeDir: hit.claudeDir, error: null, loading: false });
    } else {
      setState({ data: null, computedAt: null, claudeDir: null, error: null, loading: true });
    }

    async function tick() {
      // A backgrounded tab used to keep polling forever — /api/subagents/live every
      // 2.5s and /api/workflows every 4s, indefinitely. Skip while hidden; the
      // visibilitychange handler below fires an immediate catch-up tick on return.
      if (document.hidden) return;
      try {
        const entry = await fetchShared(url);
        if (cancelled) return;
        setState({
          data: entry.data as T,
          computedAt: entry.computedAt,
          claudeDir: entry.claudeDir,
          error: null,
          loading: false,
        });
        setLastFetch(Date.now());
      } catch (e) {
        if (cancelled) return;
        // Keep any cached/last data on screen; just surface the error.
        setState((s) => ({ ...s, error: String(e), loading: false }));
        setLastFetch(Date.now());
      }
    }

    tick();
    const id = setInterval(tick, intervalMs);

    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url, intervalMs]);

  return { ...state, lastFetch };
}
