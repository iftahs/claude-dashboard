import { cn } from '@/lib/cn';
import { segmentedControlOptionVariants, segmentedControlVariants } from './SegmentedControl.variants';
import type { SegmentedControlProps } from './types';

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  size,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn(segmentedControlVariants({ size }), className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            className={segmentedControlOptionVariants({ selected })}
            onClick={selected ? undefined : () => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
