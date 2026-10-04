import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { cn } from '@/lib/cn';
import { liveStatusVariants } from './LiveStatus.variants';
import type { LiveStatusProps } from './types';
import { LIVE_STATUS } from './utils';

export function LiveStatus({ state, label, className }: LiveStatusProps) {
  const { tone, label: defaultLabel, pulse } = LIVE_STATUS[state];

  return (
    <span className={cn(liveStatusVariants({ state }), className)}>
      <StatusDot tone={tone} size="sm" pulse={pulse} />
      {label ?? defaultLabel}
    </span>
  );
}
