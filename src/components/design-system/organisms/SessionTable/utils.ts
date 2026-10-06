import type { SessionHeadlineKind } from '@/lib/views/sessions';

export const START_HEADER = 'Start time';
export const PROJECT_HEADER = 'Project';
export const DURATION_HEADER = 'Duration';
export const TOKENS_HEADER = 'Tokens';
export const PREVIOUS_LABEL = 'Previous';
export const NEXT_LABEL = 'Next';
export const PAGER_LABEL = 'Pages';

export const HEADLINE_CLASS: Record<SessionHeadlineKind, string> = {
  title: 'text-fg',
  prompt: 'text-fg-muted',
  none: 'text-fg-subtle',
};
