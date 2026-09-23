import type { SessionMeta, ProjectStat } from '@/types';
import type { TagsApi } from '@/hooks/useTags';

export type ProjectPlatform = 'claude' | 'codex' | 'both';

export interface ProjectBreakdownProps {
  sessions: SessionMeta[];
  /** Start of the span the session list covers, for the "since …" label. */
  since: number | null;
  projectCosts?: ProjectStat[];
  /** When provided, each project row gets an inline tag editor (WS1). */
  tags?: TagsApi;
  /** Selected platform — drives copy and the per-platform session split under Both. */
  platform?: ProjectPlatform;
}

export interface LocalProjectStat {
  path: string;
  /** Display label: last path segment; a Codex chat folder shows its thread title. */
  name: string;
  /** Sum of the sessions' active time (turn durations), ms. */
  activeMs: number;
  effectiveTokens: number;
  cacheReadTokens: number;
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  sessionCount: number;
  claudeSessions: number;
  codexSessions: number;
  cost: number; // from /api/projects
}
