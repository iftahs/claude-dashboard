import { useEffect, useRef, useState } from 'react';
import type { Envelope } from '../types';

interface State<T> {
  data: T | null;
  computedAt: number | null;
  claudeDir: string | null;
  error: string | null;
  loading: boolean;
}

export function usePolling<T>(url: string, intervalMs = 5000): State<T> & { lastFetch: number } {
  const [state, setState] = useState<State<T>>({
    data: null,
    computedAt: null,
    claudeDir: null,
    error: null,
    loading: true,
  });
  const [lastFetch, setLastFetch] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    async function tick() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const env: Envelope<T> = await res.json();
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
