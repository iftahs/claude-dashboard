import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePolling } from './usePolling';
import { track } from '../lib/analytics';
import type { SourcesInfo, UsageSource } from '../types';

// Source filter (Code = Claude Code CLI, Cowork = desktop local-agent mode,
// Codex = the ChatGPT desktop app's embedded Codex). A secondary surface is only
// surfaced when the user actually has its data on disk.
export type SourceFilter = 'all' | UsageSource;

export const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: 'All',
  code: 'Code',
  cowork: 'Cowork',
  codex: 'Codex',
};

/** Secondary surfaces in toggle order. They follow All / Code, so a Cowork-only
 *  user keeps the original All / Code / Cowork toggle and Codex simply appends. */
const SECONDARY_SOURCES: UsageSource[] = ['cowork', 'codex'];

interface SourceCtx {
  source: SourceFilter;
  /** Set the filter and emit the (path-free) analytics event. */
  setSource: (s: SourceFilter) => void;
  /** Per-surface availability from /api/sources. `code` is always true. */
  available: Record<UsageSource, boolean>;
  coworkAvailable: boolean;
  codexAvailable: boolean;
  /** Any non-Code surface has data — gates the header toggle and the sources split. */
  secondaryAvailable: boolean;
  /** Toggle options: All + Code + every available secondary surface, in that order. */
  sourceOptions: { value: SourceFilter; label: string }[];
  /** Append ?source= only when a secondary surface exists and one surface is selected. */
  withSrc: (url: string) => string;
}

const SourceContext = createContext<SourceCtx | null>(null);

/**
 * Owns the surface-availability probe and the active surface filter. `withSrc()`
 * leaves URLs byte-for-byte unchanged for Code-only users (no refetch churn,
 * no behavior change) — it only scopes when a secondary surface (Cowork or
 * Codex) has data and a surface other than "all" is selected.
 */
export function SourceProvider({ children }: { children: ReactNode }) {
  // Surface detection — gates every Cowork/Codex affordance so that Code-only
  // users get the original dashboard byte-for-byte. `codex` is read defensively:
  // an older backend (e.g. a Docker image built before Codex support) omits the key.
  const sourcesInfo = usePolling<SourcesInfo>('/api/sources', 60000);
  const coworkAvailable = !!sourcesInfo.data?.cowork?.available;
  const codexAvailable = !!sourcesInfo.data?.codex?.available;
  const [source, setSourceState] = useState<SourceFilter>('all');

  const available = useMemo<Record<UsageSource, boolean>>(
    () => ({ code: true, cowork: coworkAvailable, codex: codexAvailable }),
    [coworkAvailable, codexAvailable],
  );
  const secondaryAvailable = coworkAvailable || codexAvailable;

  // If the selected surface's data disappears (or never existed), never leave a
  // stale scoped filter. Uses the raw setter so the reset doesn't emit a
  // source_changed event.
  useEffect(() => {
    if (source !== 'all' && !available[source]) setSourceState('all');
  }, [available, source]);

  const value = useMemo<SourceCtx>(() => {
    const withSrc = (url: string) =>
      secondaryAvailable && source !== 'all'
        ? url + (url.includes('?') ? '&' : '?') + `source=${source}`
        : url;
    const setSource = (s: SourceFilter) => {
      setSourceState(s);
      track('source_changed', { source: s });
    };
    const sourceOptions: { value: SourceFilter; label: string }[] = [
      { value: 'all', label: SOURCE_LABELS.all },
      { value: 'code', label: SOURCE_LABELS.code },
      ...SECONDARY_SOURCES.filter((s) => available[s]).map((s) => ({ value: s, label: SOURCE_LABELS[s] })),
    ];
    return {
      source,
      setSource,
      available,
      coworkAvailable,
      codexAvailable,
      secondaryAvailable,
      sourceOptions,
      withSrc,
    };
  }, [source, available, coworkAvailable, codexAvailable, secondaryAvailable]);

  return <SourceContext.Provider value={value}>{children}</SourceContext.Provider>;
}

export function useSource(): SourceCtx {
  const ctx = useContext(SourceContext);
  if (!ctx) throw new Error('useSource must be used within a SourceProvider');
  return ctx;
}
