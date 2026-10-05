import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { LiveStatus } from '@/components/design-system/molecules/LiveStatus/LiveStatus';
import { ThemeToggle } from '@/components/design-system/molecules/ThemeToggle/ThemeToggle';
import type { GalleryTopbarProps } from './types';

export function GalleryTopbar({ title, theme, drawerOpen, onToggleTheme, onOpenDrawer }: GalleryTopbarProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Tooltip content="Open navigation" side="bottom">
        <IconButton label="Open navigation" aria-expanded={drawerOpen} className="lg:hidden" onClick={onOpenDrawer}>
          <Icon name="menu" />
        </IconButton>
      </Tooltip>
      <h1 className="min-w-0 truncate text-title text-fg">{title}</h1>
      <div className="flex-1" />
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <LiveStatus state="live" />
    </div>
  );
}
