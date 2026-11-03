import type { SessionUsageView } from '@/lib/views/session-usage';
import type { SessionDetailView, TranscriptView } from '@/lib/views/sessions';

export interface SessionDetailBodyProps {
  view: SessionDetailView;
  transcript: TranscriptView;
  usage: SessionUsageView;
  onToggleTranscript: () => void;
  onRetryTranscript?: () => void;
}
