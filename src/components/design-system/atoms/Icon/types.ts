export type IconName =
  | 'layout'
  | 'activity'
  | 'bot'
  | 'workflow'
  | 'trending'
  | 'layers'
  | 'bars'
  | 'list'
  | 'folder'
  | 'sparkles'
  | 'sliders'
  | 'settings'
  | 'search'
  | 'sun'
  | 'moon'
  | 'panel'
  | 'chevronRight'
  | 'chevronDown'
  | 'chevronUp'
  | 'chevronLeft'
  | 'check'
  | 'x'
  | 'clock'
  | 'download'
  | 'alert'
  | 'info'
  | 'arrowUpRight'
  | 'refresh'
  | 'inbox'
  | 'copy'
  | 'externalLink'
  | 'filter'
  | 'calendar'
  | 'tag'
  | 'gitBranch'
  | 'terminal'
  | 'file'
  | 'help'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'menu'
  | 'eye'
  | 'command';

export type IconSize = 12 | 14 | 16 | 20;

export interface IconProps {
  name: IconName;
  size?: IconSize;
  className?: string;
}
