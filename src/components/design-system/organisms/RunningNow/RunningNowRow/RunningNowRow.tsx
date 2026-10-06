import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Chip } from '@/components/design-system/atoms/Chip/Chip';
import { ElapsedTime } from '@/components/design-system/atoms/ElapsedTime/ElapsedTime';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { SINCE_TITLE } from '../utils';
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
      <span
        title={SINCE_TITLE[row.sinceFormat]}
        className="flex w-16 flex-none items-baseline justify-end gap-1 whitespace-nowrap sm:w-24"
      >
        {row.sinceFormat === 'ago' ? <span className="hidden text-caption text-fg-subtle sm:inline">active</span> : null}
        <ElapsedTime since={row.since} format={row.sinceFormat} className="font-mono text-mono text-fg-muted" />
      </span>
    </li>
  );
}
