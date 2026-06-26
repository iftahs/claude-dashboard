import { useEffect, useRef, useState } from 'react';

/**
 * Tween a number toward `target` whenever it changes, for a live "counting" feel.
 *
 * Returns the current (rounded) value — the caller formats it (e.g. via `compact`).
 * First render returns `target` immediately (no 0→N sweep on mount, which would
 * collide with a card's enter animation). Subsequent changes animate from the
 * value currently on screen, so an in-flight tween interrupts smoothly rather
 * than restarting from zero.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(target);
  // Latest values read inside the rAF loop without re-subscribing the effect.
  const fromRef = useRef(target);
  const targetRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Same target (e.g. a poll handed back a new object with identical numbers) → no-op.
    if (target === targetRef.current) return;

    fromRef.current = value; // start from what's on screen now
    targetRef.current = target;
    const from = fromRef.current;
    const to = target;
    let startTs: number | null = null;
    let alive = true;

    const tick = (ts: number) => {
      if (!alive) return;
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      alive = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // `value` intentionally excluded: it changes every frame and would restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
