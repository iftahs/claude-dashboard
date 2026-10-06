import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import type { EffortSliceListProps } from './types';

export function EffortSliceList({ title, slices }: EffortSliceListProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="whitespace-nowrap text-small font-medium text-fg">{title}</span>
      <ul className="flex flex-col gap-1">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center justify-between gap-4">
            <LegendDot color={slice.color}>{slice.label}</LegendDot>
            <span className="whitespace-nowrap font-mono text-mono text-fg">{slice.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
