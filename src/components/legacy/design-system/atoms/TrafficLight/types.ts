import type { VariantProps } from 'class-variance-authority';
import type { trafficDotVariants } from './TrafficLight.variants';
import type { AgentTrafficStatus } from '@/types';

export interface TrafficLightProps {
  status: AgentTrafficStatus;
  size?: NonNullable<VariantProps<typeof trafficDotVariants>['size']>;
  /** Optional text label rendered after the dot. */
  label?: string;
  /** Pulse the dot for live (running/waiting) statuses. Default true. */
  pulse?: boolean;
  className?: string;
}
