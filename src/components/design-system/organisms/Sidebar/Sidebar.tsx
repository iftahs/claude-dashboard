import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { NavItem } from '@/components/design-system/molecules/NavItem/NavItem';
import { cn } from '@/lib/cn';
import { SidebarFooter } from './SidebarFooter/SidebarFooter';
import type { SidebarItem, SidebarProps } from './types';

export function Sidebar({
  brand,
  groups,
  pinned = [],
  activeId,
  collapsed = false,
  toggleIcon,
  toggleLabel,
  onToggle,
  onNavigate,
  dataDirs = [],
  version,
  credit,
  navLabel = 'Main',
}: SidebarProps) {
  const renderItem = (item: SidebarItem) => (
    <NavItem
      key={item.id}
      href={item.href}
      label={item.label}
      icon={item.icon}
      active={item.id === activeId}
      collapsed={collapsed}
      badge={
        item.badge ? (
          <Badge tone={item.badge.tone} title={item.badge.title}>
            {item.badge.text}
          </Badge>
        ) : undefined
      }
      onClick={onNavigate ? (event) => onNavigate(item.href, event) : undefined}
    />
  );

  return (
    // The rail is 55px wide inside its hairline: 12px + 11px of padding keeps the 32px items on whole pixels.
    <div className={cn('flex flex-1 flex-col gap-5 py-4', collapsed ? 'pl-3 pr-[11px]' : 'px-3')}>
      <div className={cn('flex h-8 flex-none items-center', collapsed ? 'justify-center' : 'justify-between pl-2')}>
        {collapsed ? null : <span className="min-w-0 animate-fade-in truncate text-heading text-fg">{brand}</span>}
        <Tooltip content={toggleLabel} side="right">
          <IconButton label={toggleLabel} onClick={onToggle}>
            <Icon name={toggleIcon} />
          </IconButton>
        </Tooltip>
      </div>
      <nav aria-label={navLabel} className="flex flex-1 flex-col gap-5">
        {groups.map((group) => (
          <div key={group.id} role="group" aria-label={group.label} className="flex flex-col gap-0.5">
            {collapsed ? null : (
              <GroupLabel as="span" className="animate-fade-in px-2 pb-1.5">
                {group.label}
              </GroupLabel>
            )}
            {group.items.map(renderItem)}
          </div>
        ))}
        {pinned.length > 0 ? <div className="mt-auto flex flex-col gap-0.5">{pinned.map(renderItem)}</div> : null}
      </nav>
      {collapsed ? null : <SidebarFooter dataDirs={dataDirs} version={version} credit={credit} />}
    </div>
  );
}
