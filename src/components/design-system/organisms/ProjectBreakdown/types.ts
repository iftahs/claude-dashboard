import type { SessionMeta, ProjectStat } from '@/types';
import type { TagsApi } from '@/hooks/useTags';

export interface ProjectBreakdownProps {
  sessions: SessionMeta[];
  periodDays: number;
  projectCosts?: ProjectStat[];
  /** When provided, each project row gets an inline tag editor (WS1). */
  tags?: TagsApi;
}

export interface LocalProjectStat {
  path: string;
  name: string;
  totalTimeMinutes: number;
  effectiveTokens: number;
  cacheReadTokens: number;
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  sessionCount: number;
  cost: number; // from /api/projects
}
