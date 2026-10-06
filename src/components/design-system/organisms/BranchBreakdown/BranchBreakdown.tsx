import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { BranchBreakdownProps } from './types';
import { LIST_LABEL } from './utils';

export function BranchBreakdown({ view, className }: BranchBreakdownProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} ai={view.ai} className={className}>
      <ul aria-label={LIST_LABEL} className="flex flex-col gap-3">
        {view.rows.map((row) => (
          <li key={row.key}>
            <MeterRow size="sm" tone="neutral" label={row.label} value={row.value} percent={row.percent} note={row.note} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
