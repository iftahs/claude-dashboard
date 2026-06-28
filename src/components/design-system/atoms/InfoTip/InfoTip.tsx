import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { InfoTipProps } from './types';

const GUTTER = 8; // min viewport padding so the popover never runs off-screen
const WIDTH = 256; // w-64

/**
 * A small "?" badge that reveals a wrapping explanation on hover/focus. The
 * popover is rendered in a body-level portal with fixed positioning so it
 * escapes the card's stacking/overflow context (cards use `backdrop-blur`,
 * which creates a stacking context that would otherwise paint it behind
 * neighbouring cards). `normal-case`/`font-normal` reset any uppercase/bold
 * styling inherited from card headers or stat labels.
 */
export function InfoTip({ text, align = 'left' }: InfoTipProps) {
  const badgeRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  function open() {
    const rect = badgeRef.current?.getBoundingClientRect();
    if (!rect) return;
    const top = rect.bottom + 6;
    // Anchor horizontally per `align`, then clamp inside the viewport gutter.
    let left =
      align === 'right'
        ? rect.right - WIDTH
        : align === 'center'
          ? rect.left + rect.width / 2 - WIDTH / 2
          : rect.left;
    const maxLeft = window.innerWidth - WIDTH - GUTTER;
    left = Math.max(GUTTER, Math.min(left, maxLeft));
    setCoords({ top, left });
  }

  return (
    <span className="relative inline-flex shrink-0 align-middle">
      <span
        ref={badgeRef}
        tabIndex={0}
        role="button"
        aria-label="More info"
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-white/10 text-[10px] font-bold leading-none text-zinc-400 transition-colors hover:bg-white/20 hover:text-zinc-200 focus:bg-white/20 focus:text-zinc-200 focus:outline-none"
        onMouseEnter={open}
        onMouseLeave={() => setCoords(null)}
        onFocus={open}
        onBlur={() => setCoords(null)}
      >
        ?
      </span>
      {coords &&
        createPortal(
          <span
            role="tooltip"
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: WIDTH }}
            className="pointer-events-none z-[1000] rounded-lg border border-white/10 bg-ink-700 px-3 py-2 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-zinc-300 shadow-xl"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
