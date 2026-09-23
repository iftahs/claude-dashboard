import type { CommandUsageData } from '@/types';

export interface CommandUsageProps {
  data: CommandUsageData | null;
  /** Empty-state copy — platform-specific (Codex records neither slash commands nor skills). */
  emptyText?: string;
}
