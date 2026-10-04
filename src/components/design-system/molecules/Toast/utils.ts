import type { IconName } from '@/components/design-system/atoms/Icon/types';
import type { ToastTone } from './types';

export const TOAST_ICONS: Record<ToastTone, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert',
  danger: 'alert',
};
