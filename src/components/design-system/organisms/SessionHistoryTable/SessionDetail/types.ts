import type { SessionMeta } from '@/types';
import type { TranscriptState } from '../TranscriptPane/types';
import type { SessionNoun } from '../types';

export interface SessionDetailProps {
  session: SessionMeta;
  transcript: TranscriptState | undefined;
  onFetchTranscript: (sessionId: string) => void;
  noun: SessionNoun;
}
