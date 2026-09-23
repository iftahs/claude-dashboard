import { Section } from '@/components/design-system/molecules/Section/Section';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { compact, usd } from '@/lib/format';
import type { SourcesSplitChartProps } from './types';

/**
 * Split of effective tokens (and equivalent cost) inside the window — between
 * surfaces (Claude Code / Cowork, plus Codex under Both) or, under the Codex
 * platform, between threads and guardian reviews. One component, one slot, so
 * every platform shows the same card. A $0 segment (the unpriced guardian model)
 * shows tokens only.
 */
export function SourcesSplitChart({ segments, weekDays, help, scope = '' }: SourcesSplitChartProps) {
  return (
    <Section title={`Sources${scope} · effective tokens · ${weekDays}d`} help={help}>
      <div className="flex flex-wrap items-center gap-4">
        {/* 2px surface gap between fills (gap-0.5 on the track colour). */}
        <div className="flex h-3 min-w-[8rem] flex-1 gap-0.5 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10">
          {segments.map((s) => (
            <div key={s.key} style={{ width: `${s.pct}%`, backgroundColor: s.color }} title={`${s.label} · ${s.pct.toFixed(0)}%`} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {segments.map((s) => (
            <LegendDot
              key={s.key}
              color={s.color}
              label={`${s.label} · ${compact(s.effectiveTokens)}${s.cost > 0 ? ` · ${usd(s.cost)}` : ''} · ${s.pct.toFixed(0)}%`}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
