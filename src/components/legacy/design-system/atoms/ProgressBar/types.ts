import type { VariantProps } from 'class-variance-authority';
import type { trackVariants, fillVariants } from './ProgressBar.variants';

export interface ProgressBarProps
  extends VariantProps<typeof trackVariants>,
    VariantProps<typeof fillVariants> {
  /** 0–100 percentage; clamped internally */
  pct: number;
  /** Hex color; overrides variant-based fill class when set */
  color?: string;
  className?: string;
}
