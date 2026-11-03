import type { SessionHeadlineKind } from '@/lib/views/sessions';

export const SORT_LABEL = 'Sort projects by';
export const LIST_LABEL = 'Projects';
export const TOTAL_LABEL = 'Total';
export const TOTAL_TITLE = 'Estimated cost summed over every project';
export const LARGE_BADGE = 'Large';

export const HEADLINE_CLASS: Record<SessionHeadlineKind, string> = {
  title: 'text-fg',
  prompt: 'text-fg-muted',
  none: 'text-fg-subtle',
};

export function tagsLabel(project: string): string {
  return `Tags for ${project}`;
}

export function toggleLabel(noun: string, project: string): string {
  return `Show ${noun} of ${project}`;
}

export function sessionsLabel(noun: string, project: string): string {
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} in ${project}`;
}
