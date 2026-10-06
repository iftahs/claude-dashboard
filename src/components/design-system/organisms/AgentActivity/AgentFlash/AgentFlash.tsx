import { cn } from '@/lib/cn';
import type { AgentFlashProps } from './types';

export function AgentFlash({ active }: AgentFlashProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-accent-soft transition-opacity motion-reduce:hidden',
        active ? 'opacity-100 duration-150' : 'opacity-0 duration-500',
      )}
    />
  );
}
