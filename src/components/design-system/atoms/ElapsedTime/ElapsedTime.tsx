import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import type { ElapsedTimeProps } from './types';
import { formatSince, tickInterval } from './utils';

export function ElapsedTime({ since, format = 'elapsed', intervalMs = 1000, className }: ElapsedTimeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), tickInterval(intervalMs));
    return () => clearInterval(timer);
  }, [since, intervalMs]);

  return <span className={cn('whitespace-nowrap tabular-nums', className)}>{formatSince(now - since, format)}</span>;
}
