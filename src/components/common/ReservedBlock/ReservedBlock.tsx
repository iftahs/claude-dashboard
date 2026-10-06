import { useRememberedHeight } from '@/hooks/useRememberedHeight';
import { useSource } from '@/hooks/useSource';
import type { ReservedBlockProps } from './types';

export function ReservedBlock({ id, settled, children }: ReservedBlockProps) {
  const { effectiveSource } = useSource();
  const { ref, minHeight } = useRememberedHeight<HTMLDivElement>(`${id}:${effectiveSource ?? 'all'}`, settled);

  return (
    <div ref={ref} className="flex min-w-0 flex-col" style={{ minHeight }}>
      {children}
    </div>
  );
}
