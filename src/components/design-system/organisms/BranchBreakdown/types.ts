import type { InsightsBranches } from '@/types';

export interface BranchBreakdownProps {
  data: InsightsBranches[] | null;
  /** Empty-state copy — platform-specific (a Codex chat thread usually runs outside a repo). */
  emptyText?: string;
}
