import type { SessionMeta, ProjectStat } from '@/types';
import type { TagsApi } from '@/hooks/useTags';

export interface TagBreakdownProps {
  sessions: SessionMeta[];
  projectCosts?: ProjectStat[];
  tags: TagsApi;
}

export interface TagGroup {
  /** Tag name, or '' for the catch-all untagged bucket. */
  tag: string;
  cost: number;
  effectiveTokens: number;
  projectCount: number;
  sessionCount: number;
}
