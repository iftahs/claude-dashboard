import { toggleButtonVariants } from './ToggleGroup.variants';
import type { ToggleGroupProps, ToggleOption } from './types';

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  uppercase = false,
}: ToggleGroupProps<T>) {
  return (
    <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10">
      {options.map((opt: ToggleOption<T>) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={toggleButtonVariants({ active: value === opt.value, uppercase })}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
