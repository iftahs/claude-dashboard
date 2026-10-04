export function spendingBarColor(pct: number): string {
  if (pct > 90) return '#ef4444';
  if (pct > 70) return '#f59e0b';
  return '#10b981';
}
