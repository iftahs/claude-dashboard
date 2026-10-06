import type { DropdownMenuAlign } from '@/components/design-system/molecules/DropdownMenu/types';
import type { ExportFormat } from '@/lib/export';

export interface ExportMenuProps {
  onExport: (format: ExportFormat) => void;
  label?: string;
  disabled?: boolean;
  align?: DropdownMenuAlign;
  className?: string;
}
