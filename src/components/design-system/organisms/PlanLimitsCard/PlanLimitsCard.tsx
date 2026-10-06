import { memo } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { cn } from '@/lib/cn';
import { PlanLimitsRow } from './PlanLimitsRow/PlanLimitsRow';
import type { PlanLimitsCardProps } from './types';
import { ACTIVE_LABEL } from './utils';

export const PlanLimitsCard = memo(function PlanLimitsCard({ view, columns = 1, className }: PlanLimitsCardProps) {
  const { account, plan, active, rows, gates, note } = view;

  return (
    <Section
      title={view.title}
      description={
        account ? (
          <span title={account} className="block truncate">
            {account}
          </span>
        ) : undefined
      }
      help={view.help}
      as="h3"
      state={view.state}
      className={cn(active && 'border-accent', className)}
      actions={
        active || plan ? (
          <>
            {active ? <Badge tone="accent">{ACTIVE_LABEL}</Badge> : null}
            {plan ? <Badge>{plan}</Badge> : null}
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {rows.length > 0 ? (
          <div className={cn('grid grid-cols-1 gap-x-8 gap-y-5', columns === 2 && 'md:grid-cols-2')}>
            {rows.map((row) => (
              <PlanLimitsRow key={row.key} row={row} />
            ))}
          </div>
        ) : null}
        {gates.length > 0 ? (
          <div className={cn('flex flex-col gap-2', rows.length > 0 && 'border-t border-line pt-4')}>
            {gates.map((gate) => (
              <KeyValueRow key={gate.key} label={gate.label} value={gate.status} tone={gate.tone} />
            ))}
          </div>
        ) : null}
        {note ? <p className="text-caption text-fg-subtle">{note}</p> : null}
      </div>
    </Section>
  );
});
