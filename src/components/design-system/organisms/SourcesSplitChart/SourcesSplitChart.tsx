import { Section } from '@/components/design-system/molecules/Section/Section';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { compact, usd } from '@/lib/format';
import type { SourcesSplitChartProps } from './types';
import { SOURCE_COLOR, computeSourceSplit } from './utils';

/**
 * Split of effective tokens (and equivalent cost) between Claude Code and Cowork
 * over the selected window. Caller gates this on the All filter, where the split
 * is meaningful (a single-surface filter zeroes the other).
 */
export function SourcesSplitChart({ bySource, weekDays }: SourcesSplitChartProps) {
  const { codeEff, coworkEff, codePct } = computeSourceSplit(bySource);

  return (
    <Section
      title={`Sources · effective tokens · ${weekDays}d`}
      help="Split of effective tokens (and equivalent cost) between Claude Code (CLI) and Cowork (desktop local-agent mode) over the selected window."
    >
      <div className="flex items-center gap-4">
        <div className="flex flex-1 h-3 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10">
          <div style={{ width: `${codePct}%`, backgroundColor: SOURCE_COLOR.code }} />
          <div style={{ width: `${100 - codePct}%`, backgroundColor: SOURCE_COLOR.cowork }} />
        </div>
        <div className="flex items-center gap-4">
          <LegendDot color={SOURCE_COLOR.code} label={`Code · ${compact(codeEff)} · ${usd(bySource.code.cost)}`} />
          <LegendDot color={SOURCE_COLOR.cowork} label={`Cowork · ${compact(coworkEff)} · ${usd(bySource.cowork.cost)}`} />
        </div>
      </div>
    </Section>
  );
}
