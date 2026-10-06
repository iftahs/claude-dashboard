import { memo } from 'react';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { SpendCapsRow } from './SpendCapsRow/SpendCapsRow';
import type { SpendCapsCardProps } from './types';

export const SpendCapsCard = memo(function SpendCapsCard({ view, className }: SpendCapsCardProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} as="h3" state={view.state} className={className}>
      <div className="flex flex-col gap-5 md:grid md:auto-cols-fr md:grid-flow-col md:gap-x-8">
        {view.rows.map((row) => (
          <SpendCapsRow key={row.key} row={row} />
        ))}
      </div>
    </Section>
  );
});
