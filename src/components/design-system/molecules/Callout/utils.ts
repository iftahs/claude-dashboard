import type { IconName } from '@/components/design-system/atoms/Icon/types';
import type { CalloutTone } from './types';

export const CALLOUT_ICONS: Record<CalloutTone, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert',
  danger: 'alert',
  neutral: 'info',
};
