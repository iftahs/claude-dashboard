import { useEffect, useState } from 'react';
import { ago } from '@/lib/format';
import type { LiveBadgeProps } from './types';

export function LiveBadge({ computedAt, error }: LiveBadgeProps) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      {error ? (
        <>
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          <span className="text-red-400">connection error</span>
        </>
      ) : (
        <>
          <span className="pulse-dot" />
          <span>live</span>
          {computedAt && <span className="text-zinc-500">· updated {ago(computedAt)}</span>}
        </>
      )}
    </div>
  );
}
