import { Button } from '@/components/design-system/atoms/Button/Button';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { Kbd } from '@/components/design-system/atoms/Kbd/Kbd';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { LiveStatus } from '@/components/design-system/molecules/LiveStatus/LiveStatus';
import { StatusChip } from '@/components/design-system/molecules/StatusChip/StatusChip';
import { ThemeToggle } from '@/components/design-system/molecules/ThemeToggle/ThemeToggle';
import { cn } from '@/lib/cn';
import type { TopbarProps, TopbarScope } from './types';
import { ROOMY, TIGHT } from './utils';

function scopeControl<T extends string>(scope: TopbarScope<T>, className: string) {
  return (
    <Tooltip content={scope.help} side="bottom">
      <span className={cn('flex-none', className)}>
        <SegmentedControl ariaLabel={scope.label} options={scope.options} value={scope.value} onChange={scope.onChange} />
      </span>
    </Tooltip>
  );
}

export function Topbar<P extends string = string, S extends string = string>({
  title,
  drawerOpen,
  onOpenDrawer,
  platform,
  surface,
  limit,
  agents,
  shortcut,
  onOpenPalette,
  theme,
  onToggleTheme,
  live,
  onNavigate,
}: TopbarProps<P, S>) {
  // Two switchers leave too little room for the secondary text, so it appears one breakpoint later.
  const show = platform && surface ? TIGHT : ROOMY;

  return (
    <div className={cn('flex min-w-0 flex-1 items-center', show.gap)}>
      <Tooltip content="Open navigation" side="bottom">
        <IconButton label="Open navigation" aria-expanded={drawerOpen} className="lg:hidden" onClick={onOpenDrawer}>
          <Icon name="menu" />
        </IconButton>
      </Tooltip>
      <h1 className="min-w-0 flex-1 truncate text-title text-fg">{title}</h1>
      {platform ? scopeControl(platform, 'hidden sm:inline-flex') : null}
      {surface ? scopeControl(surface, 'hidden md:inline-flex') : null}
      {(platform || surface) && (limit || agents) ? (
        <span aria-hidden="true" className={cn('h-5 w-px flex-none bg-line', show.divider)} />
      ) : null}
      {limit ? (
        <StatusChip
          href={limit.href}
          tone={limit.tone}
          icon={limit.tone === 'neutral' ? undefined : 'alert'}
          tooltip={limit.title}
          aria-label={`${limit.window} ${limit.value}`}
          onClick={onNavigate ? (event) => onNavigate(limit.href, event) : undefined}
        >
          <span>
            <span className="hidden xl:inline">{limit.window} </span>
            {limit.value}
          </span>
        </StatusChip>
      ) : null}
      {agents ? (
        <StatusChip
          href={agents.href}
          tone={agents.tone}
          icon={agents.tone === 'danger' ? 'alert' : agents.running ? undefined : 'bot'}
          pulse={agents.running}
          tooltip={agents.title}
          aria-label={`${agents.count} ${agents.label}`}
          onClick={onNavigate ? (event) => onNavigate(agents.href, event) : undefined}
        >
          <span>
            {agents.count}
            <span className="hidden xl:inline"> {agents.label}</span>
          </span>
        </StatusChip>
      ) : null}
      {/* A native title, not Tooltip: focus returns here when the palette closes, which would reopen a tooltip every time. */}
      <Button
        aria-label="Jump to"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        title={`Jump to (${shortcut})`}
        className="gap-2 border-line px-2 font-normal text-fg-subtle enabled:hover:text-fg"
        onClick={onOpenPalette}
      >
        <Icon name="search" size={14} />
        <span className={cn('text-small', show.jumpLabel)}>Jump to</span>
        <Kbd className={show.shortcut}>{shortcut}</Kbd>
      </Button>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <LiveStatus state={live.state} label={live.label} captionClassName={show.liveCaption} />
    </div>
  );
}
