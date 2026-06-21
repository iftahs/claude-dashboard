import type { AiBackend } from '@/types';

export interface AiInsightInlineProps {
  text?: string;
  loading?: boolean;
  error?: string;
  backend?: AiBackend;
  onDismiss: () => void;
}
