import type { UseAutoResume } from '@/hooks/useAutoResume';

export interface AutoResumeViewProps {
  autoResume: UseAutoResume;
  /** `permissions.allow` rules from settings.json, offered as checkboxes. */
  allowRules: string[];
}
