import type { RunningSinceFormat } from '@/lib/views/overview';

export const SKELETON_ROWS = 3;

export const SINCE_TITLE: Record<RunningSinceFormat, string> = {
  ago: 'Time since the last activity',
  elapsed: 'Running time',
};

export function moreLabel(count: number): string {
  return `${count} more running`;
}
