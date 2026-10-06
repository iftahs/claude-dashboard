export function tabElementId(id: string | undefined, value: string): string | undefined {
  return id ? `${id}-tab-${value}` : undefined;
}

export function tabPanelId(id: string | undefined, value: string): string | undefined {
  return id ? `${id}-panel-${value}` : undefined;
}

export function targetTabIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  if (key === 'ArrowRight') return (current + 1) % count;
  if (key === 'ArrowLeft') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
