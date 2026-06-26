import type { LiveBadgeProps } from './types';

export function LiveBadge({ error }: LiveBadgeProps) {
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
        </>
      )}
    </div>
  );
}
