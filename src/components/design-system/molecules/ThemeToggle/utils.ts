import type { IconName } from '@/components/design-system/atoms/Icon/types';
import type { ThemeToggleTheme } from './types';

export const THEME_TOGGLE: Record<ThemeToggleTheme, { icon: IconName; label: string }> = {
  dark: { icon: 'sun', label: 'Switch to light theme' },
  light: { icon: 'moon', label: 'Switch to dark theme' },
};
