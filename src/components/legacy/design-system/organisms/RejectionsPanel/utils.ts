import { toolLabel } from '@/lib/format';
import type { Platform } from '@/hooks/useSource';

/** The tool name a Codex guardian deny is recorded under (server GUARDIAN_DENY_TOOL). */
const GUARDIAN_DENY_TOOL = 'GuardianReview';

/** A rejected call's row label; the guardian's deny names no tool, so it gets its own. */
export function rejectionToolLabel(name: string): string {
  return name === GUARDIAN_DENY_TOOL ? 'Guardian deny' : toolLabel(name);
}

/** How the panel names a person's decline on each platform. */
export function declineNoun(platform: Platform): string {
  return platform === 'claude' ? 'declined permission prompts' : 'declined by you';
}

/** Empty-state copy per platform. */
export function emptyRejections(platform: Platform): string {
  if (platform === 'codex') return 'No guardian denials or declined actions in this window.';
  if (platform === 'both') return 'No declined prompts or guardian denials in this window.';
  return 'No permission rejections in this window.';
}
