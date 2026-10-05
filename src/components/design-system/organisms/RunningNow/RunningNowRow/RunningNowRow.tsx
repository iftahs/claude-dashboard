import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Chip } from '@/components/design-system/atoms/Chip/Chip';
import { ElapsedTime } from '@/components/design-system/atoms/ElapsedTime/ElapsedTime';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import type { RunningNowRowProps } from './types';

export function RunningNowRow({ row }: RunningNowRowProps) {
  return (
    <li className="flex h-11 min-w-0 items-center gap-3">
      {row.waiting ? <StatusDot tone="danger" /> : <StatusDot tone="success" pulse label="Running" />}
      <span title={row.project} className="min-w-0 flex-1 truncate text-body font-medium text-fg sm:max-w-[40%] sm:flex-none">
        {row.project}
      </span>
      <span title={row.task} className="hidden min-w-0 flex-1 truncate text-body text-fg-muted sm:block">
        {row.task}
      </span>
      {row.badge ? <Badge tone={row.badge.tone}>{row.badge.label}</Badge> : null}
      <Chip color={row.modelColor ?? undefined} className="hidden sm:inline-flex">
        {row.model}
      </Chip>
      <ElapsedTime since={row.since} className="w-16 flex-none text-right font-mono text-mono text-fg-muted" />
    </li>
  );
}
