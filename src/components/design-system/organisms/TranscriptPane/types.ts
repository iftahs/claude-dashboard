import type { TranscriptView } from '@/lib/views/sessions';

export interface TranscriptPaneProps {
  view: TranscriptView;
  onRetry?: () => void;
  id?: string;
  className?: string;
}
