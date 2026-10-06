import { Chip } from '@/components/design-system/atoms/Chip/Chip';
import { cn } from '@/lib/cn';
import type { InventoryChipProps } from './types';
import { LONG_META_LENGTH } from './utils';

export function InventoryChip({ item }: InventoryChipProps) {
  return (
    <Chip title={item.title ?? item.label} className={cn('max-w-full overflow-hidden', item.muted && 'border-dashed text-fg-subtle')}>
      <span className="min-w-8 truncate">{item.label}</span>
      {item.meta.map((meta, index) => (
        <span
          key={`${index}:${meta}`}
          className={cn('text-fg-subtle', meta.length > LONG_META_LENGTH ? 'min-w-8 truncate' : 'flex-none')}
        >
          {meta}
        </span>
      ))}
    </Chip>
  );
}
