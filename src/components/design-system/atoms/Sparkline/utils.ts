const MIN_BAR_HEIGHT = 3;

export const GROW_DELAY_MS = 100;

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function sparklineBarHeights(values: number[], height: number): number[] {
  const safe = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const max = Math.max(0, ...safe);
  if (max === 0) return safe.map(() => MIN_BAR_HEIGHT);
  return safe.map((value) => Math.max(MIN_BAR_HEIGHT, Math.round((value / max) * height)));
}
