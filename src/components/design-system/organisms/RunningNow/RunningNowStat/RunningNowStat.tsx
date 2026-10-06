import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { cn } from '@/lib/cn';
import type { RunningNowStatProps } from './types';

export function RunningNowStat({ stat }: RunningNowStatProps) {
  return (
    <div className="flex flex-none items-baseline gap-2 whitespace-nowrap">
      {stat.alert ? <Icon name="alert" className="self-center text-danger-fg" /> : null}
      <span className={cn('text-metric', stat.alert ? 'text-danger-fg' : 'text-fg')}>{stat.value}</span>
      <span className="text-small text-fg-muted">{stat.label}</span>
    </div>
  );
}
