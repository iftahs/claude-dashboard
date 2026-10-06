import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
import { SHARE_NOTE } from '../utils';
import type { LimitContributorsBreakdownProps } from './types';

export function LimitContributorsBreakdown({ breakdown }: LimitContributorsBreakdownProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <GroupLabel as="span" note={SHARE_NOTE}>
        {breakdown.label}
      </GroupLabel>
      <div className="flex flex-col gap-3">
        {breakdown.rows.map((row) => (
          <MeterRow key={row.name} size="sm" label={row.name} value={`${row.percent}%`} percent={row.percent} />
        ))}
      </div>
    </div>
  );
}
