import type { SessionTranscript } from '@/types';

export interface TranscriptState {
  data: SessionTranscript | null;
  loading: boolean;
  error: string | null;
}

export interface TranscriptPaneProps {
  sessionId: string;
  onFetch: (id: string) => void;
  state: TranscriptState | undefined;
}
