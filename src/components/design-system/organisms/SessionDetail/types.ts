import type { SessionUsageView } from '@/lib/views/session-usage';
import type { SessionDetailView, TranscriptView } from '@/lib/views/sessions';

export interface SessionDetailProps {
  view: SessionDetailView | null;
  transcript: TranscriptView;
  usage: SessionUsageView;
  onClose: () => void;
  onToggleTranscript: () => void;
  onRetryTranscript?: () => void;
}
