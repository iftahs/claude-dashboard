import type { CapGroupView, CapPeriod } from '@/lib/views/settings';

export interface SpendingCapsFormProps {
  idPrefix: string;
  group: CapGroupView;
  onChange: (period: CapPeriod, value: string) => void;
  onSave: () => void;
  onClear: () => void;
}
