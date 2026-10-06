import { useId } from 'react';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { InventoryChip } from '../InventoryChip/InventoryChip';
import type { InventoryGroupProps } from './types';

export function InventoryGroup({ group }: InventoryGroupProps) {
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId} className="flex min-w-0 flex-col gap-2">
      <GroupLabel as="span" id={labelId} note={String(group.count)}>
        {group.title}
      </GroupLabel>
      {group.items.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {group.items.map((item) => (
            <InventoryChip key={item.key} item={item} />
          ))}
        </div>
      ) : (
        <p className="text-small text-fg-subtle">None</p>
      )}
    </div>
  );
}
