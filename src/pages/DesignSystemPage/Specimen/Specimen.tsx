import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import type { SpecimenProps } from './types';

export function Specimen({ name, children, note, layout = 'row' }: SpecimenProps) {
  return (
    <div data-specimen={name} className="flex min-w-0 flex-col gap-3">
      <GroupLabel as="h3" note={note}>
        {name}
      </GroupLabel>
      <div className={layout === 'row' ? 'flex flex-wrap items-center gap-3' : 'flex min-w-0 flex-col gap-3'}>{children}</div>
    </div>
  );
}
