import { Section } from '@/components/design-system/molecules/Section/Section';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { compact, usd } from '@/lib/format';
import type { SourcesSplitChartProps } from './types';
import { SOURCE_COLOR, SOURCE_LABEL, computeSourceSplit } from './utils';

/**
 * Split of effective tokens (and equivalent cost) between the surfaces with data
 * in the window — Claude Code, Cowork and Codex. Caller gates this on the All
 * filter, where the split is meaningful (a single-surface filter zeroes the rest).
 */
export function SourcesSplitChart({ bySource, weekDays }: SourcesSplitChartProps) {
  const segments = computeSourceSplit(bySource);

  return (
    <Section
      title={`Sources · effective tokens · ${weekDays}d`}
      help="Split of effective tokens (and equivalent cost) between Claude Code (CLI), Cowork (desktop local-agent mode) and Codex (ChatGPT desktop) over the selected window."
    >
      <div className="flex items-center gap-4">
        <div className="flex flex-1 h-3 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10">
          {segments.map((s) => (
            <div key={s.source} style={{ width: `${s.pct}%`, backgroundColor: SOURCE_COLOR[s.source] }} />
          ))}
        </div>
        <div className="flex items-center gap-4">
          {segments.map((s) => (
            <LegendDot
              key={s.source}
              color={SOURCE_COLOR[s.source]}
              label={`${SOURCE_LABEL[s.source]} · ${compact(s.effectiveTokens)} · ${usd(s.cost)}`}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
