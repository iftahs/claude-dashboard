import type { SessionMeta, ProjectStat } from '@/types';

export interface ProjectBreakdownProps {
  sessions: SessionMeta[];
  periodDays: number;
  projectCosts?: ProjectStat[];
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
