import { Chip } from '@/components/design-system/atoms/Chip/Chip';
import { cn } from '@/lib/cn';
import type { InventoryChipProps } from './types';

export function InventoryChip({ item }: InventoryChipProps) {
  return (
    <Chip title={item.title ?? item.label} className={cn('max-w-full', item.muted && 'border-dashed text-fg-subtle')}>
      <span className="min-w-0 truncate">{item.label}</span>
      {item.meta.map((meta, index) => (
        <span key={`${index}:${meta}`} className="flex-none text-fg-subtle">
          {meta}
        </span>
      ))}
    </Chip>
  );
}
