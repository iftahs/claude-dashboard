import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePolling } from './usePolling';
import { track } from '../lib/analytics';
import type { SourcesInfo, UsageSource } from '../types';
import type { Platform, SourceFilter } from '../lib/platform';

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
export type { Platform, SourceFilter };

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
const HINT_KEY = 'claude-dashboard-sources-hint';

// What the last /api/sources said, so the first paint uses the same switchers and data URLs as the loaded page.
interface SourcesHint {
  codex: boolean;
  cowork: boolean;
  claude: boolean;
  claudeDir: string;
  coworkDir: string;
  codexDir: string;
}

function loadHint(): SourcesHint | null {
  try {
    const v = JSON.parse(localStorage.getItem(HINT_KEY) ?? 'null') as Partial<SourcesHint> | null;
    if (!v || typeof v !== 'object') return null;
    const text = (x: unknown) => (typeof x === 'string' ? x : '');
    return {
      codex: v.codex === true,
      cowork: v.cowork === true,
      claude: v.claude !== false,
      claudeDir: text(v.claudeDir),
      coworkDir: text(v.coworkDir),
      codexDir: text(v.codexDir),
    };
  } catch {
    return null;
  }
}

/** The platform the user last picked, or null when they never picked one. */
function loadPlatform(): Platform | null {
  try {
    const v = localStorage.getItem(PLATFORM_KEY);
    return v === 'claude' || v === 'codex' || v === 'both' ? v : null;
  } catch {
    return null;
  }
}

/** One data folder behind what is on screen, for the sidebar's path line. */
export interface DataDir {
  /** 'Claude' / 'Cowork' / 'Codex'. */
  label: string;
  path: string;
}

interface SourceCtx {
  /** Effective platform — 'claude' whenever Codex data is absent; with nothing stored, 'codex' for a Codex-only user, else 'claude'. */
  platform: Platform;
  setPlatform: (p: Platform) => void;
  /** Switcher options; empty (switcher hidden) until Codex data exists. */
  platformOptions: { value: Platform; label: string; title: string }[];
  /** Render the Claude-side panels (platform is Claude or Both). */
  showClaude: boolean;
  /** Any Claude Code / Cowork events exist locally (false until /api/sources answers). */
  claudeAvailable: boolean;
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
  /** /api/sources has answered at least once; until then the platform is a 'claude' placeholder, so anything irreversible (a toast) should wait. */
  sourcesLoaded: boolean;
  /** The /api/sources fetch error while it has never succeeded; null once any response landed. */
  sourcesError: string | null;
  /** Whether the platform+surface on screen has ANY local events ever (lifetime, from /api/sources), or null until it answers — not the Live/Trends windows, which read zero for an idle-today user. */
  hasScopeData: boolean | null;
  /** The data folders behind the platform + surface on screen (empty on an older backend). */
  dataDirs: DataDir[];
}

const SourceContext = createContext<SourceCtx | null>(null);

export function SourceProvider({ children }: { children: ReactNode }) {
  // Surface detection — gates every Cowork/Codex affordance so that Code-only
  // users get the original dashboard byte-for-byte. `codex` is read defensively:
  // an older backend (e.g. a Docker image built before Codex support) omits the key.
  const sourcesInfo = usePolling<SourcesInfo>('/api/sources', 60000);
  const sources = sourcesInfo.data;
  const sourcesLoaded = !!sources;
  const sourcesError = sources ? null : sourcesInfo.error;
  // Until the first answer the layout-driving flags come from the last session's hint; sourcesLoaded, hasScopeData and the counts stay honest.
  const [hint] = useState(loadHint);
  const coworkAvailable = sources ? !!sources.cowork?.available : !!hint?.cowork;
  const codexAvailable = sources ? !!sources.codex?.available : !!hint?.codex;
  const codeN = sources?.code?.events ?? 0;
  const coworkN = sources?.cowork?.events ?? 0;
  const codexN = sources?.codex?.events ?? 0;
  const claudeAvailable = codeN + coworkN > 0;
  const hasClaudeEvents = sources ? claudeAvailable : hint?.claude ?? true;
  const [storedPlatform, setStoredPlatform] = useState<Platform | null>(loadPlatform);
  const [source, setSourceState] = useState<SourceFilter>('all');

  // With no stored choice, a Codex-only user (Codex events, no Claude/Cowork ones) starts on Codex instead of an empty Claude dashboard.
  const defaultPlatform: Platform = codexAvailable && !hasClaudeEvents ? 'codex' : 'claude';
  const platform: Platform = codexAvailable ? storedPlatform ?? defaultPlatform : 'claude';

  // The surface filter narrows the Claude side only, and only while it is offered.
  const surface: SourceFilter = platform === 'claude' && coworkAvailable ? source : 'all';
  const claudeN = surface === 'code' ? codeN : surface === 'cowork' ? coworkN : codeN + coworkN;
  const hasScopeData: boolean | null = !sources
    ? null
    : (platform === 'codex' ? codexN : platform === 'claude' ? claudeN : codeN + coworkN + codexN) > 0;

  const claudeDirPath = sources ? sources.claudeDir ?? '' : hint?.claudeDir ?? '';
  const coworkDirPath = sources ? sources.coworkDir ?? '' : hint?.coworkDir ?? '';
  const codexDirPath = sources ? sources.codexDir ?? '' : hint?.codexDir ?? '';

  useEffect(() => {
    if (!sources) return;
    const next: SourcesHint = {
      codex: codexAvailable,
      cowork: coworkAvailable,
      claude: claudeAvailable,
      claudeDir: claudeDirPath,
      coworkDir: coworkDirPath,
      codexDir: codexDirPath,
    };
    try { localStorage.setItem(HINT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }, [sources, codexAvailable, coworkAvailable, claudeAvailable, claudeDirPath, coworkDirPath, codexDirPath]);
  const dataDirs = useMemo<DataDir[]>(() => {
    const dirs: DataDir[] = [];
    if (platform !== 'codex') {
      if (surface !== 'cowork' && claudeDirPath) dirs.push({ label: 'Claude', path: claudeDirPath });
      if (surface !== 'code' && coworkAvailable && coworkDirPath) dirs.push({ label: 'Cowork', path: coworkDirPath });
    }
    if (platform !== 'claude' && codexDirPath) dirs.push({ label: 'Codex', path: codexDirPath });
    return dirs;
  }, [platform, surface, coworkAvailable, claudeDirPath, coworkDirPath, codexDirPath]);

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
      claudeAvailable,
      codexAvailable,
      secondaryAvailable,
      effectiveSource,
      withSrc,
      sourcesLoaded,
      sourcesError,
      hasScopeData,
      dataDirs,
    };
  }, [
    platform, source, available, coworkAvailable, claudeAvailable, codexAvailable, secondaryAvailable,
    sourcesLoaded, sourcesError, hasScopeData, dataDirs,
  ]);

  return <SourceContext.Provider value={value}>{children}</SourceContext.Provider>;
}

export function useSource(): SourceCtx {
  const ctx = useContext(SourceContext);
  if (!ctx) throw new Error('useSource must be used within a SourceProvider');
  return ctx;
}
