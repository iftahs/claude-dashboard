import { dotVariants } from './LegendDot.variants';
import type { LegendDotProps } from './types';

export function LegendDot({
  color,
  label,
  size = 'sm',
  labelClassName = 'text-[11px] text-zinc-400',
}: LegendDotProps) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={dotVariants({ size })}
        style={{ backgroundColor: color }}
      />
      <span className={labelClassName}>{label}</span>
    </span>
  );
}
