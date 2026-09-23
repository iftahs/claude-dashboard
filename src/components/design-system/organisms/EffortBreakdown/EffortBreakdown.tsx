import { useState } from 'react';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { compact, effortLabel, shortModel, usd } from '@/lib/format';
import { modelColor } from '@/lib/palette';
import type { EffortSlice } from '@/types';
import type { EffortBarProps, EffortBreakdownProps } from './types';
import { effortColor, reasoningLabel, slicePcts } from './utils';

/** 100%-stacked effort mix; a 2px surface gap separates the fills. */
function EffortBar({ slices, size = 'sm' }: EffortBarProps) {
  const pcts = slicePcts(slices);
  return (
    <div
      className={`flex w-full gap-0.5 overflow-hidden rounded-full bg-ink-700 ${size === 'md' ? 'h-3' : 'h-2'}`}
    >
      {slices.map((s, i) =>
        pcts[i] > 0 ? (
          <div key={s.effort} style={{ width: `${pcts[i]}%`, backgroundColor: effortColor(s.effort) }} />
        ) : null,
      )}
    </div>
  );
}

/** Tooltip body: every effort level of one row, with tokens, share and cost. */
function SliceList({ slices }: { slices: EffortSlice[] }) {
  const pcts = slicePcts(slices);
  return (
    <div className="space-y-0.5">
      {slices.map((s, i) => (
        <div key={s.effort} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: effortColor(s.effort) }} />
            {effortLabel(s.effort)}
          </span>
          <span className="tabular-nums text-zinc-400">
            {compact(s.effectiveTokens)} · {pcts[i].toFixed(0)}%{s.cost > 0 ? ` · ${usd(s.cost)}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// Identical for Claude and Codex; under Both the model rows already separate the platforms.
export function EffortBreakdown({ data }: EffortBreakdownProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  if (data.models.length === 0) {
    return <div className="flex h-[120px] items-center justify-center text-sm text-zinc-500">No usage in this window</div>;
  }
  const pcts = slicePcts(data.efforts);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 text-xs text-zinc-500">
          <span>All models · effective tokens by effort</span>
          <span>
            Reasoning share of output:{' '}
            <span className="font-semibold text-zinc-300">{reasoningLabel(data.reasoning)}</span>
          </span>
        </div>
        <EffortBar slices={data.efforts} size="md" />
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {data.efforts.map((s, i) => (
            <LegendDot
              key={s.effort}
              color={effortColor(s.effort)}
              label={`${effortLabel(s.effort)} · ${compact(s.effectiveTokens)} · ${pcts[i].toFixed(0)}%${
                s.cost > 0 ? ` · ${usd(s.cost)}` : ''
              }`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1 border-t border-white/10 pt-3">
        <div className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem_4.5rem] items-center gap-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <span>Model</span>
          <span>Effort mix</span>
          <span className="text-right">Est. cost</span>
          <span className="text-right">Reasoning</span>
        </div>
        {data.models.map((m, idx) => (
          <div
            key={m.model}
            className="relative grid grid-cols-[minmax(0,9rem)_1fr_4.5rem_4.5rem] items-center gap-3 rounded-md px-0 py-1 hover:bg-white/[0.03]"
            onMouseEnter={() => setHovered(m.model)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="truncate" title={m.model}>
              <LegendDot color={modelColor(m.model)} label={shortModel(m.model)} labelClassName="text-xs text-zinc-300" />
            </span>
            <EffortBar slices={m.efforts} />
            <span className="text-right text-xs tabular-nums text-zinc-400">{m.cost > 0 ? usd(m.cost) : '—'}</span>
            <span className="text-right text-xs tabular-nums text-zinc-400">{reasoningLabel(m.reasoning)}</span>
            {/* Card opens below the first row so the section header never clips it. */}
            {hovered === m.model && (
              <div
                className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 ${
                  idx === 0 ? 'top-full mt-1' : 'bottom-full mb-1'
                }`}
              >
                <ChartTooltip label={`${shortModel(m.model)} · ${compact(m.effectiveTokens)} effective`} minWidth={200}>
                  <SliceList slices={m.efforts} />
                </ChartTooltip>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
