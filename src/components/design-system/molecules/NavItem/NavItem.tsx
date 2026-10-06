import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { cn } from '@/lib/cn';
import { navItemVariants } from './NavItem.variants';
import type { NavItemProps } from './types';

export function NavItem({ href, label, icon, active = false, collapsed = false, badge, onClick, className }: NavItemProps) {
  const current = active ? 'page' : undefined;

  if (collapsed) {
    return (
      <Tooltip
        side="right"
        content={
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            {label}
            {badge}
          </span>
        }
      >
        <a
          href={href}
          aria-label={label}
          aria-current={current}
          onClick={onClick}
          className={cn(navItemVariants({ active, collapsed }), className)}
        >
          <Icon name={icon} size={20} />
        </a>
      </Tooltip>
    );
  }

  return (
    <a href={href} aria-current={current} onClick={onClick} className={cn(navItemVariants({ active, collapsed }), className)}>
      <Icon name={icon} />
      <span className="min-w-0 flex-1 animate-fade-in truncate">{label}</span>
      {badge}
    </a>
  );
}
