import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';

const PREFIX = 'claude-dashboard-height:';

function widthBucket(): string {
  const width = window.innerWidth;
  return width >= 1280 ? 'xl' : width >= 1024 ? 'lg' : width >= 768 ? 'md' : 'sm';
}

function read(key: string): number | undefined {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export interface RememberedHeight<T extends HTMLElement> {
  ref: RefObject<T>;
  minHeight: number | undefined;
}

// A block whose height depends on the data keeps the height it had last time while it loads, so what sits under it does not jump.
export function useRememberedHeight<T extends HTMLElement>(id: string, settled: boolean): RememberedHeight<T> {
  const ref = useRef<T>(null);
  const key = `${PREFIX}${id}:${widthBucket()}`;
  const remembered = useMemo(() => read(key), [key]);

  useEffect(() => {
    const element = ref.current;
    if (!settled || !element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      try {
        localStorage.setItem(key, String(Math.round(element.offsetHeight)));
      } catch {
        /* storage blocked: nothing to remember */
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [settled, key]);

  return { ref, minHeight: settled ? undefined : remembered };
}
