import type { SessionUsageView } from '@/lib/views/session-usage';

export interface SessionUsagePanelProps {
  view: SessionUsageView;
  /** Called with a session id from the picker; the picker is hidden when the view has none. */
  onSessionChange?: (sessionId: string) => void;
  /** Heading level of the card title; use `h3` under another heading. */
  as?: 'h2' | 'h3';
  className?: string;
}
