import { memo } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { LimitHitsFigure } from './LimitHitsFigure/LimitHitsFigure';
import { LimitHitsRow } from './LimitHitsRow/LimitHitsRow';
import type { LimitHitsCardProps } from './types';
import { BLOCKED_LABEL, NO_HITS } from './utils';

export const LimitHitsCard = memo(function LimitHitsCard({ view, className }: LimitHitsCardProps) {
  const { figures, rows } = view;

  return (
    <Section
      title={view.title}
      description={view.description}
      help={view.help}
      as="h3"
      state={view.state}
      className={className}
      actions={view.blocked ? <Badge tone="danger">{BLOCKED_LABEL}</Badge> : undefined}
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-4">
          {figures.map((figure) => (
            <LimitHitsFigure key={figure.key} figure={figure} />
          ))}
        </dl>
        {rows.length > 0 ? (
          <ul className="flex flex-col border-t border-line">
            {rows.map((row) => (
              <LimitHitsRow key={row.key} row={row} />
            ))}
          </ul>
        ) : (
          <p className="border-t border-line pt-4 text-small text-fg-muted">{NO_HITS}</p>
        )}
      </div>
    </Section>
  );
});
