import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { cn } from '@/lib/cn';
import { statusChipVariants } from './StatusChip.variants';
import type { StatusChipProps } from './types';

export function StatusChip({ href, tone, icon, pulse = false, tooltip, className, children, ...props }: StatusChipProps) {
  return (
    <Tooltip content={tooltip} side="bottom">
      <a href={href} className={cn(statusChipVariants({ tone }), className)} {...props}>
        {pulse ? <StatusDot tone="success" size="sm" pulse /> : null}
        {icon ? <Icon name={icon} size={14} /> : null}
        {children}
      </a>
    </Tooltip>
  );
}
