import { toggleButtonVariants } from './ToggleGroup.variants';
import type { ToggleGroupProps, ToggleOption } from './types';

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  uppercase = false,
  grow = false,
}: ToggleGroupProps<T>) {
  return (
    <div
      className={`flex overflow-hidden rounded-lg ring-1 ring-white/10 ${
        grow ? 'w-full divide-x divide-white/10' : ''
      }`}
    >
      {options.map((opt: ToggleOption<T>) => (
        <button
          key={opt.value}
          onClick={() => !opt.disabled && onChange(opt.value)}
          disabled={opt.disabled}
          title={opt.title}
          className={`${toggleButtonVariants({ active: value === opt.value, uppercase })} ${
            grow ? 'flex-1 py-1.5 text-center' : ''
          } ${opt.disabled ? 'cursor-not-allowed opacity-40 hover:text-zinc-500' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
