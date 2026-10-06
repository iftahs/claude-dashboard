import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import type { ThemeToggleProps } from './types';
import { THEME_TOGGLE } from './utils';

export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  const { icon, label } = THEME_TOGGLE[theme];

  return (
    <Tooltip content={label} side="bottom">
      <IconButton label={label} onClick={onToggle} className={className}>
        <Icon name={icon} />
      </IconButton>
    </Tooltip>
  );
}
