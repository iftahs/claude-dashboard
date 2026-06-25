import { trafficDotVariants } from './TrafficLight.variants';
import type { TrafficLightProps } from './types';
import type { AgentTrafficStatus } from '@/types';

const STATUS_TITLE: Record<AgentTrafficStatus, string> = {
  finished: 'Task finished',
  running: 'Task running',
  waiting: 'Waiting for your attention',
};

/** Green/amber/red status dot for an agent's traffic-light state. */
export function TrafficLight({ status, size = 'sm', label, pulse = true, className = '' }: TrafficLightProps) {
  const animate = pulse && status !== 'finished';
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={STATUS_TITLE[status]}>
      <span className={`${trafficDotVariants({ status, size })} ${animate ? 'animate-pulse' : ''}`} />
      {label && <span className="text-xs text-zinc-400">{label}</span>}
    </span>
  );
}
