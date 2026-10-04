import { longDateLabel } from '@/lib/format';
import type { ArchiveSummary } from '@/types';

/** Limit-alert thresholds offered as toggles (100% — the limit itself — always alerts). */
export const THRESHOLD_CHOICES = [50, 60, 70, 80, 90, 95] as const;

/** Toggle one threshold, keeping the list sorted and never empty. */
export function toggleThreshold(current: number[], t: number): number[] {
  const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
  return next.length > 0 ? next.sort((a, b) => a - b) : current;
}

/** "3 archived files · 1.2 MB · since Mar 12, 2026" for the archive row. */
export function archiveLine(s: ArchiveSummary): string {
  const size = s.bytes >= 1_048_576 ? `${(s.bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(s.bytes / 1024))} KB`;
  const since = s.oldestTs !== null ? ` · since ${longDateLabel(s.oldestTs)}` : '';
  return `${s.files} archived file${s.files === 1 ? '' : 's'} · ${size}${since}`;
}
