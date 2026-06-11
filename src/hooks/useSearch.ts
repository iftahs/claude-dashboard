import { useState, useEffect, useRef } from 'react';
import type { SearchResult } from '../types';

interface SearchState {
  results: SearchResult[] | null;
  loading: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 450;

export function useSearch(query: string, days = 50): SearchState {
  const [state, setState] = useState<SearchState>({ results: null, loading: false, error: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 3) {
      setState({ results: null, loading: false, error: null });
      return;
    }

    setState((s) => ({ ...s, loading: true }));

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const url = `/api/search?q=${encodeURIComponent(query)}&days=${days}`;
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((env: { data: SearchResult[] }) => {
          setState({ results: env.data, loading: false, error: null });
        })
        .catch((e: unknown) => {
          setState({ results: null, loading: false, error: String(e) });
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, days]);

  return state;
}
