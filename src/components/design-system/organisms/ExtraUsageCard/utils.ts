import type { ExtraUsageHeadlineView } from '@/lib/views/live';

export function headlineValue(usage: ExtraUsageHeadlineView): string {
  return usage.limit === null ? usage.value : `${usage.value} of ${usage.limit}`;
}

export function headlineNote(percent: number): string {
  return `${percent}% used`;
}
