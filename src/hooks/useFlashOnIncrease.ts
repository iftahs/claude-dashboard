import { useEffect, useRef, useState } from 'react';

/**
 * Returns `true` for a short window (`holdMs`) after `value` increases — used to
 * briefly highlight a card when an agent makes progress (more tokens / fresh
 * activity). Never fires on mount (the enter animation already covers that), and
 * compares the primitive number so it's immune to the new-object-every-poll churn
 * from `usePolling`.
 */
export function useFlashOnIncrease(value: number, holdMs = 800): boolean {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const increased = value > prevRef.current;
    prevRef.current = value;
    if (!increased) return;

    setFlash(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlash(false), holdMs);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [value, holdMs]);

  return flash;
}
