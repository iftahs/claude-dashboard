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
