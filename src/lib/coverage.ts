import type { WeeklyData } from '@/types';

const DAY = 86_400_000;

// Divisor for per-day averages: when history starts inside the window, spans from the first event to now (not the full window), so a new install's rate isn't diluted; quiet days after that still count.
export function coverageDays(weekly: WeeklyData | null | undefined, weekDays: number, now = Date.now()): number {
  if (!weekly || weekly.firstEventTs == null) return weekDays;
  const start = Math.max(weekly.rangeFrom, weekly.firstEventTs);
  return Math.max(1, Math.min(weekDays, Math.ceil((now - start) / DAY)));
}
