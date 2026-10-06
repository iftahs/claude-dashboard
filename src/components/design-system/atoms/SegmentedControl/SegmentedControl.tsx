import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { segmentedControlOptionVariants, segmentedControlVariants } from './SegmentedControl.variants';
import type { SegmentedControlProps, SegmentedControlThumb } from './types';
import { sameThumb } from './utils';

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  size,
  className,
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<SegmentedControlThumb | null>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);

  useLayoutEffect(() => {
    const measure = () => {
      const option = optionRefs.current[selectedIndex];
      const next = option && option.offsetWidth > 0 ? { left: option.offsetLeft, width: option.offsetWidth } : null;
      setThumb((previous) => (sameThumb(previous, next) ? previous : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    if (groupRef.current) observer.observe(groupRef.current);
    for (const option of optionRefs.current) if (option) observer.observe(option);
    return () => observer.disconnect();
  }, [selectedIndex, options.length]);

  return (
    <div ref={groupRef} role="group" aria-label={ariaLabel} className={cn(segmentedControlVariants({ size }), className)}>
      {thumb ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0.5 left-0 top-0.5 rounded-tag border border-line-strong bg-surface-raised transition-[transform,width] duration-base ease-emphasized"
          style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
        />
      ) : null}
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={(node) => {
              optionRefs.current[index] = node;
            }}
            type="button"
            aria-pressed={selected}
            className={segmentedControlOptionVariants({ selected, floating: selected && thumb !== null })}
            onClick={selected ? undefined : () => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
