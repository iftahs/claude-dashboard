import { cn } from '@/lib/cn';
import type { IconProps } from './types';
import { ICONS } from './utils';

export function Icon({ name, size = 16, className }: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph size={size} strokeWidth={1.5} aria-hidden="true" focusable="false" className={cn('flex-none', className)} />;
}
