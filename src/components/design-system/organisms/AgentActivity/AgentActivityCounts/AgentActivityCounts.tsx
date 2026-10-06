import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import type { AgentActivityCountsProps } from './types';

export function AgentActivityCounts({ counts }: AgentActivityCountsProps) {
  if (counts.length === 0) return null;

  return (
    <ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      {counts.map((count) => (
        <li key={count.key} className="flex flex-none items-center gap-1.5">
          <Badge tone={count.tone}>
            {count.live ? <StatusDot tone="success" size="sm" pulse /> : null}
            {count.label}
          </Badge>
          {count.help ? <InfoTip label={`About ${count.label}`} content={count.help} side="bottom" /> : null}
        </li>
      ))}
    </ul>
  );
}
