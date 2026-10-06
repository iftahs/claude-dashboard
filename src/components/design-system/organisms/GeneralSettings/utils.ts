import type { KeyValueRowTone } from '@/components/design-system/molecules/KeyValueRow/types';
import type { StatusRow } from '@/lib/views/settings';

export const STATUS_TONE: Record<StatusRow['tone'], KeyValueRowTone> = {
  ok: 'success',
  warn: 'warning',
  muted: 'default',
};
