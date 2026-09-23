import type { UsageSource } from './scan.ts';

/** Where each platform's local data is read from, as the server sees it (container paths in Docker). */
export interface SourceDirs {
  claudeDir: string;
  codexDir: string;
  /** The Cowork desktop root, or null when this OS has no plausible default and COWORK_DIR is unset. */
  coworkDir: string | null;
}

interface SurfaceCount {
  events: number;
  /** Epoch ms of the newest event, 0 when there are none. */
  lastTs: number;
}

/**
 * GET /api/sources. Per-surface lifetime event counts gate the Cowork and Codex UI
 * (`available`) and drive the dashboard's empty state and default platform. The
 * dirs label the sidebar with the folder behind whatever platform is on screen.
 */
export interface SourcesSummary extends SourceDirs {
  code: SurfaceCount;
  cowork: SurfaceCount & { available: boolean };
  codex: SurfaceCount & { available: boolean };
}

/** summarizeSources' `codex.available`, without counting everything else. */
export function hasCodexEvents(events: readonly { source: UsageSource }[]): boolean {
  return events.some((e) => e.source === 'codex');
}

/** Count events and find the newest one per surface. Pure: no I/O. */
export function summarizeSources(
  events: readonly { source: UsageSource; ts: number }[],
  dirs: SourceDirs,
): SourcesSummary {
  const n: Record<UsageSource, SurfaceCount> = {
    code: { events: 0, lastTs: 0 },
    cowork: { events: 0, lastTs: 0 },
    codex: { events: 0, lastTs: 0 },
  };
  for (const e of events) {
    // Anything that is not Cowork or Codex is Claude Code, as filterSource() treats it.
    const c = e.source === 'cowork' || e.source === 'codex' ? n[e.source] : n.code;
    c.events++;
    if (e.ts > c.lastTs) c.lastTs = e.ts;
  }
  return {
    code: n.code,
    cowork: { available: n.cowork.events > 0, ...n.cowork },
    codex: { available: n.codex.events > 0, ...n.codex },
    claudeDir: dirs.claudeDir,
    codexDir: dirs.codexDir,
    coworkDir: dirs.coworkDir || null,
  };
}
