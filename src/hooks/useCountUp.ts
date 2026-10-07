import { useEffect, useRef, useState } from 'react';

export interface CountUpOptions {
  // Value of the first render; the hook then counts from it to `target` once. Omitted, the first render is `target`.
  from?: number;
}

const SETTLE_MARGIN_MS = 100;

function motionOff(): boolean {
  return document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Tween a number toward `target` whenever it changes, for a live "counting" feel.
 *
 * Returns the current (rounded) value — the caller formats it (e.g. via `compact`).
 * First render returns `target` immediately unless `options.from` asks for a count
 * from another value. Subsequent changes animate from the value currently on screen,
 * so an in-flight tween interrupts smoothly rather than restarting from zero. With
 * reduced motion, or in a hidden tab, the value lands at once.
 */
export function useCountUp(target: number, durationMs = 600, options: CountUpOptions = {}): number {
  const [value, setValue] = useState(() => (motionOff() ? target : (options.from ?? target)));
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return undefined;

    const show = (next: number) => {
      shownRef.current = next;
      setValue(next);
    };
    if (motionOff()) {
      show(target);
      return undefined;
    }

    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      show(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    let frame = requestAnimationFrame(tick);
    // Frames stop while a tab is hidden; the timer still lands the final value.
    const settle = setTimeout(() => show(target), durationMs + SETTLE_MARGIN_MS);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [target, durationMs]);

  return value;
}

interface CountShape {
  text: string;
  prefix: string;
  scaled: number;
  decimals: number;
  grouped: boolean;
  suffix: string;
}

// One number with an optional sign or currency before it and a short unit after it: "42%", "~$12.34", "1.2M", "1,204".
const COUNT_PATTERN = /^([~≈+\-−]?\$?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,4}))?(\s?(?:[KMBT]|%|x|×|ms|s|m|h|d))?$/;

function parseCount(text: string): CountShape | null {
  const match = COUNT_PATTERN.exec(text.trim());
  if (!match) return null;
  const [, prefix, whole, fraction = '', suffix = ''] = match;
  const scaled = Number(whole.replace(/,/g, '') + fraction);
  if (!Number.isSafeInteger(scaled)) return null;
  return { text, prefix, scaled, decimals: fraction.length, grouped: whole.includes(','), suffix };
}

function formatCount(shape: CountShape, scaled: number): string {
  const [whole, fraction] = (scaled / 10 ** shape.decimals).toFixed(shape.decimals).split('.');
  const grouped = shape.grouped ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
  return `${shape.prefix}${grouped}${fraction ? `.${fraction}` : ''}${shape.suffix}`;
}

// The text to show while the first plain number counts up from zero; `null` whenever the caller should render its own value.
export function useCountUpText(value: unknown, durationMs = 600): string | null {
  const first = useRef<CountShape | null>(null);
  const done = useRef(false);

  if (!done.current && !first.current && typeof value === 'string') {
    const parsed = parseCount(value);
    if (parsed && motionOff()) done.current = true;
    else first.current = parsed;
  }
  const shape = first.current;
  const shown = useCountUp(shape?.scaled ?? 0, durationMs, { from: 0 });
  if (shape && (shown === shape.scaled || value !== shape.text)) done.current = true;

  return shape && !done.current ? formatCount(shape, shown) : null;
}
