import { sidebarBadgeVariants } from './SidebarBadge.variants';
import type { SidebarBadgeProps } from './types';

export function SidebarBadge({ tone, label, title, pulse }: SidebarBadgeProps) {
  return (
    <span className={sidebarBadgeVariants({ tone })} title={title}>
      {pulse && <span className="pulse-dot flex-none" />}
      {label}
    </span>
  );
}
