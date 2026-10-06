import type { MouseEvent } from 'react';
import type { LimitGlanceView } from '@/lib/views/overview';

export interface LimitGlanceProps {
  view: LimitGlanceView;
  href?: string;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  className?: string;
}
