import type { AiChatMessageView } from '@/lib/views/ai';

export type AiChatBubbleKind = 'user' | 'assistant' | 'error';

export interface AiChatMessageProps {
  message: AiChatMessageView;
}
