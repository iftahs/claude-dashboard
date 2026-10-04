import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { selectItemVariants, selectTriggerVariants } from './Select.variants';
import type { SelectProps } from './types';

export function Select({ value, onValueChange, options, ariaLabel, placeholder, size, disabled, id, className }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value ?? ''} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger id={id} aria-label={ariaLabel} className={cn(selectTriggerVariants({ size }), className)}>
        <span className="min-w-0 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="flex-none text-fg-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-control border border-line bg-surface-raised shadow-pop"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item key={option.value} value={option.value} className={selectItemVariants({ size })}>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="inline-flex flex-none">
                  <Check size={14} strokeWidth={1.5} aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
