import { useState, useEffect, useRef } from 'react';
import { useSource } from './useSource';
import type { SearchResult } from '../types';

interface SearchState {
  results: SearchResult[] | null;
  loading: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 450;
/** The server clamps `days` to 1–90. */
const MAX_DAYS = 90;

// Scoped to the selected platform/surface like the session table it feeds — under Codex a Claude transcript hit could not be opened.
export function useSearch(query: string, days = 50): SearchState {
  const { withSrc } = useSource();
  const [state, setState] = useState<SearchState>({ results: null, loading: false, error: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const span = Math.max(1, Math.min(MAX_DAYS, Math.round(days) || 1));
  const url = withSrc(`/api/search?q=${encodeURIComponent(query)}&days=${span}`);

  useEffect(() => {
    if (query.length < 3) {
      setState({ results: null, loading: false, error: null });
      return;
    }

    setState((s) => ({ ...s, loading: true }));
    if (timerRef.current) clearTimeout(timerRef.current);

    let cancelled = false;
    timerRef.current = setTimeout(() => {
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((env: { data: SearchResult[] }) => {
          if (!cancelled) setState({ results: env.data, loading: false, error: null });
        })
        .catch((e: unknown) => {
          if (!cancelled) setState({ results: null, loading: false, error: String(e) });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, url]);

  return state;
}
