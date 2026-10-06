import type { SessionDetailView, TranscriptView } from '@/lib/views/sessions';

export interface SessionDetailProps {
  view: SessionDetailView | null;
  transcript: TranscriptView;
  onClose: () => void;
  onToggleTranscript: () => void;
  onRetryTranscript?: () => void;
}
