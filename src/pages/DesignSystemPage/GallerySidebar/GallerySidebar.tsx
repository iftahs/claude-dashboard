import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { NavItem } from '@/components/design-system/molecules/NavItem/NavItem';
import { cn } from '@/lib/cn';
import type { GallerySidebarProps } from './types';

export function GallerySidebar({
  sections,
  activeId,
  collapsed,
  toggleIcon,
  toggleLabel,
  onToggle,
  onNavigate,
}: GallerySidebarProps) {
  return (
    <div className={cn('flex flex-1 flex-col gap-5 py-4', collapsed ? 'pl-3 pr-[11px]' : 'px-3')}>
      <div className={cn('flex h-8 items-center', collapsed ? 'justify-center' : 'justify-between pl-2')}>
        {collapsed ? null : <span className="min-w-0 truncate text-heading text-fg">AI Usage</span>}
        <Tooltip content={toggleLabel} side="right">
          <IconButton label={toggleLabel} onClick={onToggle}>
            <Icon name={toggleIcon} />
          </IconButton>
        </Tooltip>
      </div>
      <nav aria-label="Design system" className="flex flex-1 flex-col gap-0.5">
        {collapsed ? null : (
          <GroupLabel as="span" className="px-2 pb-1.5">
            Design system
          </GroupLabel>
        )}
        {sections.map((section) => (
          <NavItem
            key={section.id}
            href={`#${section.id}`}
            label={section.label}
            icon={section.icon}
            active={section.id === activeId}
            collapsed={collapsed}
            badge={<Badge>{section.count}</Badge>}
            onClick={() => onNavigate(section.id)}
          />
        ))}
      </nav>
      <div className="flex flex-col gap-0.5">
        <NavItem href="/live" label="Back to the app" icon="chevronLeft" collapsed={collapsed} />
        {collapsed ? null : (
          <div className="mt-2 flex flex-col gap-0.5 border-t border-line px-2 pt-3">
            <span className="truncate font-mono text-mono text-fg-subtle">src/components/design-system</span>
            <span className="text-caption text-fg-subtle">Development only</span>
          </div>
        )}
      </div>
    </div>
  );
}
