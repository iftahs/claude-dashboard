import { memo } from 'react';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { CONTRIB_RANGE_OPTIONS } from '@/lib/views/live';
import { LimitContributorsBreakdown } from './LimitContributorsBreakdown/LimitContributorsBreakdown';
import type { LimitContributorsProps } from './types';
import { NOTHING_NOTABLE, RANGE_LABEL } from './utils';

export const LimitContributors = memo(function LimitContributors({ view, onRangeChange, className }: LimitContributorsProps) {
  const { behaviors, breakdowns } = view;

  return (
    <Section
      title={view.title}
      description={view.description}
      help={view.help}
      as="h3"
      state={view.state}
      className={className}
      actions={
        <SegmentedControl
          ariaLabel={RANGE_LABEL}
          size="sm"
          options={CONTRIB_RANGE_OPTIONS}
          value={view.range}
          onChange={(range) => onRangeChange(view.key, range)}
        />
      }
    >
      <div className="flex flex-col gap-5">
        {behaviors.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {behaviors.map((behavior) => (
              <li key={behavior.key} className="flex gap-2">
                <Icon name="arrowUpRight" size={14} className="mt-0.5 flex-none text-accent-fg" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-body font-medium text-fg">{behavior.headline}</p>
                  <p className="text-small text-fg-muted">{behavior.body}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-fg-muted">{NOTHING_NOTABLE}</p>
        )}

        {breakdowns.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 border-t border-line pt-5 sm:grid-cols-2">
            {breakdowns.map((breakdown) => (
              <LimitContributorsBreakdown key={breakdown.key} breakdown={breakdown} />
            ))}
          </div>
        ) : null}
      </div>
    </Section>
  );
});
