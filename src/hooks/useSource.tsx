import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePolling } from './usePolling';
import { track } from '../lib/analytics';
import type { SourcesInfo, UsageSource } from '../types';

/**
 * Two levels of scoping:
 *
 *  - PLATFORM — Claude (Anthropic: Claude Code + Cowork) vs Codex (OpenAI, the
 *    ChatGPT desktop app) vs Both. Only offered once /api/sources reports Codex
 *    data; until then the platform is pinned to Claude and nothing below changes.
 *  - SURFACE — inside the Claude platform, the original Code / Cowork filter.
 *
 * `withSrc()` folds both into the single `?source=` the backend understands:
 * Claude → `claude` (or `code` / `cowork` when a surface is picked), Codex →
 * `codex`, Both → no parameter. For Claude-only users the URLs stay byte-for-byte
 * what they were before Codex support existed.
 */
export type Platform = 'claude' | 'codex' | 'both';
export type SourceFilter = 'all' | UsageSource;

export const PLATFORM_LABELS: Record<Platform, string> = { claude: 'Claude', codex: 'Codex', both: 'Both' };
export const PLATFORM_OPTIONS: { value: Platform; label: string; title: string }[] = [
  { value: 'claude', label: PLATFORM_LABELS.claude, title: 'Claude Code + Cowork (Anthropic)' },
  { value: 'codex', label: PLATFORM_LABELS.codex, title: 'Codex in the ChatGPT desktop app (OpenAI)' },
  { value: 'both', label: PLATFORM_LABELS.both, title: 'Both platforms side by side' },
];

export const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: 'All',
  code: 'Code',
  cowork: 'Cowork',
  codex: 'Codex',
};

const PLATFORM_KEY = 'claude-dashboard-platform';

function loadPlatform(): Platform {
  try {
    const v = localStorage.getItem(PLATFORM_KEY);
    return v === 'codex' || v === 'both' ? v : 'claude';
  } catch {
    return 'claude';
  }
}

interface SourceCtx {
  /** Effective platform — 'claude' whenever Codex data is absent, whatever was stored. */
  platform: Platform;
  setPlatform: (p: Platform) => void;
  /** Switcher options; empty (switcher hidden) until Codex data exists. */
  platformOptions: { value: Platform; label: string; title: string }[];
  /** Render the Claude-side panels (platform is Claude or Both). */
  showClaude: boolean;
  /** Render the Codex-side panels (platform is Codex or Both). */
  showCodex: boolean;
  /** Claude surface sub-filter (All / Code / Cowork). Meaningful only under the Claude platform. */
  source: SourceFilter;
  setSource: (s: SourceFilter) => void;
  /** Surface toggle options (All / Code / Cowork) — shown only when Cowork data exists and the platform is Claude. */
  sourceOptions: { value: SourceFilter; label: string }[];
  showSurfaceToggle: boolean;
  /** Per-surface availability from /api/sources. `code` is always true. */
  available: Record<UsageSource, boolean>;
  coworkAvailable: boolean;
  codexAvailable: boolean;
  /** Any non-Code surface has data. */
  secondaryAvailable: boolean;
  /** The `?source=` value data URLs get right now, or null when they get none. */
  effectiveSource: 'claude' | SourceFilter | null;
  withSrc: (url: string) => string;
}

const SourceContext = createContext<SourceCtx | null>(null);

export function SourceProvider({ children }: { children: ReactNode }) {
  // Surface detection — gates every Cowork/Codex affordance so that Code-only
  // users get the original dashboard byte-for-byte. `codex` is read defensively:
  // an older backend (e.g. a Docker image built before Codex support) omits the key.
  const sourcesInfo = usePolling<SourcesInfo>('/api/sources', 60000);
  const coworkAvailable = !!sourcesInfo.data?.cowork?.available;
  const codexAvailable = !!sourcesInfo.data?.codex?.available;
  const [storedPlatform, setStoredPlatform] = useState<Platform>(loadPlatform);
  const [source, setSourceState] = useState<SourceFilter>('all');

  const platform: Platform = codexAvailable ? storedPlatform : 'claude';

  const available = useMemo<Record<UsageSource, boolean>>(
    () => ({ code: true, cowork: coworkAvailable, codex: codexAvailable }),
    [coworkAvailable, codexAvailable],
  );
  const secondaryAvailable = coworkAvailable || codexAvailable;

  // Never leave a stale surface filter: the surface toggle only knows Code/Cowork,
  // and a Cowork filter is meaningless once Cowork data disappears.
  useEffect(() => {
    if (source === 'codex' || (source !== 'all' && !available[source])) setSourceState('all');
  }, [available, source]);

  const value = useMemo<SourceCtx>(() => {
    const showSurfaceToggle = coworkAvailable && platform === 'claude';
    const surfaceScoped = coworkAvailable && source !== 'all';
    const effectiveSource: SourceCtx['effectiveSource'] = !codexAvailable
      ? surfaceScoped ? source : null
      : platform === 'codex'
        ? 'codex'
        : platform === 'claude'
          ? surfaceScoped ? source : 'claude'
          : null;
    const withSrc = (url: string) =>
      effectiveSource ? url + (url.includes('?') ? '&' : '?') + `source=${effectiveSource}` : url;
    const setSource = (s: SourceFilter) => {
      setSourceState(s);
      track('source_changed', { source: s });
    };
    const setPlatform = (p: Platform) => {
      setStoredPlatform(p);
      try { localStorage.setItem(PLATFORM_KEY, p); } catch { /* private mode */ }
      track('platform_changed', { platform: p });
    };
    const sourceOptions: { value: SourceFilter; label: string }[] = [
      { value: 'all', label: SOURCE_LABELS.all },
      { value: 'code', label: SOURCE_LABELS.code },
      ...(coworkAvailable ? [{ value: 'cowork' as const, label: SOURCE_LABELS.cowork }] : []),
    ];
    return {
      platform,
      setPlatform,
      platformOptions: codexAvailable ? PLATFORM_OPTIONS : [],
      showClaude: platform !== 'codex',
      showCodex: platform !== 'claude',
      source,
      setSource,
      sourceOptions,
      showSurfaceToggle,
      available,
      coworkAvailable,
      codexAvailable,
      secondaryAvailable,
      effectiveSource,
      withSrc,
    };
  }, [platform, source, available, coworkAvailable, codexAvailable, secondaryAvailable]);

  return <SourceContext.Provider value={value}>{children}</SourceContext.Provider>;
}

export function useSource(): SourceCtx {
  const ctx = useContext(SourceContext);
  if (!ctx) throw new Error('useSource must be used within a SourceProvider');
  return ctx;
}
