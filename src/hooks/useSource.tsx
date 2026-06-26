import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePolling } from './usePolling';
import { track } from '../lib/analytics';
import type { SourcesInfo, UsageSource } from '../types';

// Source filter (Code = Claude Code CLI, Cowork = desktop local-agent mode).
// Only surfaced when the user actually has Cowork data on disk.
export type SourceFilter = 'all' | UsageSource;

export const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'code', label: 'Code' },
  { value: 'cowork', label: 'Cowork' },
];

interface SourceCtx {
  source: SourceFilter;
  /** Set the filter and emit the (path-free) analytics event. */
  setSource: (s: SourceFilter) => void;
  coworkAvailable: boolean;
  /** Append ?source= only when Cowork data exists and a surface is selected. */
  withSrc: (url: string) => string;
}

const SourceContext = createContext<SourceCtx | null>(null);

/**
 * Owns the Cowork-availability probe and the active surface filter. `withSrc()`
 * leaves URLs byte-for-byte unchanged for Code-only users (no refetch churn,
 * no behavior change) — it only scopes when Cowork data exists and a surface
 * other than "all" is selected.
 */
export function SourceProvider({ children }: { children: ReactNode }) {
  // Cowork detection — gates every Cowork affordance so that Code-only users
  // get the original dashboard byte-for-byte.
  const sourcesInfo = usePolling<SourcesInfo>('/api/sources', 60000);
  const coworkAvailable = !!sourcesInfo.data?.cowork.available;
  const [source, setSourceState] = useState<SourceFilter>('all');

  // If Cowork data disappears (or never existed), never leave a stale scoped
  // filter. Uses the raw setter so the reset doesn't emit a source_changed event.
  useEffect(() => {
    if (!coworkAvailable && source !== 'all') setSourceState('all');
  }, [coworkAvailable, source]);

  const value = useMemo<SourceCtx>(() => {
    const withSrc = (url: string) =>
      coworkAvailable && source !== 'all'
        ? url + (url.includes('?') ? '&' : '?') + `source=${source}`
        : url;
    const setSource = (s: SourceFilter) => {
      setSourceState(s);
      track('source_changed', { source: s });
    };
    return { source, setSource, coworkAvailable, withSrc };
  }, [source, coworkAvailable]);

  return <SourceContext.Provider value={value}>{children}</SourceContext.Provider>;
}

export function useSource(): SourceCtx {
  const ctx = useContext(SourceContext);
  if (!ctx) throw new Error('useSource must be used within a SourceProvider');
  return ctx;
}
