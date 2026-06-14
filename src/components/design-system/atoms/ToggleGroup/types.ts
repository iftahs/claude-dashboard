import type { VariantProps } from 'class-variance-authority';
import type { toggleButtonVariants } from './ToggleGroup.variants';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

export interface ToggleGroupProps<T extends string> extends VariantProps<typeof toggleButtonVariants> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (v: T) => void;
  uppercase?: boolean;
  /** Stretch to full width with equal-width segments and dividers between them. */
  grow?: boolean;
}
