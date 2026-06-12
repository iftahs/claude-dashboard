import type { InfoTipProps } from './types';

/**
 * A small "?" badge that reveals a wrapping explanation on hover. Pure CSS
 * (group-hover), no state. `normal-case`/`font-normal` reset any uppercase/bold
 * styling inherited from card headers or stat labels.
 */
export function InfoTip({ text, align = 'left' }: InfoTipProps) {
  const horizontal =
    align === 'right' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0';

  return (
    <span className="group relative inline-flex shrink-0 align-middle">
      <span
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-white/10 text-[10px] font-bold leading-none text-zinc-400 transition-colors group-hover:bg-white/20 group-hover:text-zinc-200"
        aria-hidden="true"
      >
        ?
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute top-6 ${horizontal} z-30 w-64 rounded-lg border border-white/10 bg-ink-700 px-3 py-2 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-zinc-300 opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100`}
      >
        {text}
      </span>
    </span>
  );
}
