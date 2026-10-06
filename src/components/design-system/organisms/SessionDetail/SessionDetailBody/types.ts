import type { SessionDetailView, TranscriptView } from '@/lib/views/sessions';

export interface SessionDetailBodyProps {
  view: SessionDetailView;
  transcript: TranscriptView;
  onToggleTranscript: () => void;
  onRetryTranscript?: () => void;
}
