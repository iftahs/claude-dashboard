import type { SessionMeta } from '@/types';
import type { SessionNoun, TranscriptState } from '@/lib/sessions';

export interface SessionDetailProps {
  session: SessionMeta;
  transcript: TranscriptState | undefined;
  onFetchTranscript: (sessionId: string) => void;
  noun: SessionNoun;
}
