import { Chip } from '@/components/design-system/atoms/Chip/Chip';
import { displayModel } from '@/lib/agents';
import { modelColor } from '@/lib/palette';
import type { ModelChipProps } from './types';
import { isUnsetModel } from './utils';

export function ModelChip({ model, className }: ModelChipProps) {
  const id = model?.trim() ?? '';
  const unset = isUnsetModel(id);

  return (
    <Chip color={unset ? undefined : modelColor(id)} title={unset ? undefined : id} className={className}>
      {displayModel(id)}
    </Chip>
  );
}
