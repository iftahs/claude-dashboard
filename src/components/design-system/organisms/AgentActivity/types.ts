import type { BadgeTone } from '@/components/design-system/atoms/Badge/types';
import type { StatusDotTone } from '@/components/design-system/atoms/StatusDot/types';
import type { AgentActivityView } from '@/lib/views/agents';

export interface AgentActivityProps {
  view: AgentActivityView;
  className?: string;
}

export interface StateLook {
  label: string;
  dot: StatusDotTone;
  badge: BadgeTone;
  pulse: boolean;
}
