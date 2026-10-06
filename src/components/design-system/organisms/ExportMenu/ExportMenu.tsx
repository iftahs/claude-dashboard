import { Button } from '@/components/design-system/atoms/Button/Button';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { DropdownMenu } from '@/components/design-system/molecules/DropdownMenu/DropdownMenu';
import type { ExportMenuProps } from './types';

export function ExportMenu({ onExport, label = 'Export', disabled = false, align = 'end', className }: ExportMenuProps) {
  return (
    <DropdownMenu
      align={align}
      trigger={
        <Button size="sm" disabled={disabled} className={className}>
          <Icon name="download" />
          {label}
        </Button>
      }
      items={[
        { key: 'csv', label: 'Export CSV', onSelect: () => onExport('csv') },
        { key: 'json', label: 'Export JSON', onSelect: () => onExport('json') },
      ]}
    />
  );
}
