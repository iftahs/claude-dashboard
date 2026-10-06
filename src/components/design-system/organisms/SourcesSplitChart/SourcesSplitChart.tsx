import { memo } from 'react';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { SourcesSplitChartProps } from './types';
import { NO_COST, barLabel } from './utils';

export const SourcesSplitChart = memo(function SourcesSplitChart({ view, className }: SourcesSplitChartProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} className={className}>
      <div role="img" aria-label={barLabel(view.rows)} className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {view.rows.map((row) => (
          <span key={row.key} style={{ width: `${row.width}%`, backgroundColor: row.color }} />
        ))}
      </div>
      <ul className="mt-3 flex min-w-0 flex-col">
        {view.rows.map((row) => (
          <li key={row.key} className="flex h-11 min-w-0 items-center gap-3 border-t border-line first:border-t-0">
            <span aria-hidden="true" className="size-2 flex-none rounded-[2px]" style={{ backgroundColor: row.color }} />
            <span title={row.label} className="min-w-0 flex-1 truncate text-body text-fg">
              {row.label}
            </span>
            <span className="w-14 flex-none whitespace-nowrap text-right font-mono text-mono tabular-nums text-fg-muted">
              {row.tokens}
            </span>
            <span className="w-10 flex-none whitespace-nowrap text-right font-mono text-mono tabular-nums text-fg-muted">
              {row.percent}
            </span>
            <span className="w-16 flex-none whitespace-nowrap text-right font-mono text-mono tabular-nums text-fg">
              {row.cost ?? NO_COST}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
});
