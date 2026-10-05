import type { MouseEvent } from 'react';
import type { RunningNowView } from '@/lib/views/overview';

export interface RunningNowProps {
  view: RunningNowView;
  href: string;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  className?: string;
}
