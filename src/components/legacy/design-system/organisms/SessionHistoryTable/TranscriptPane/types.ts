import type { SessionNoun, TranscriptState } from '@/lib/sessions';

export interface TranscriptPaneProps {
  sessionId: string;
  onFetch: (id: string) => void;
  state: TranscriptState | undefined;
  noun: SessionNoun;
}
