import type { MouseEvent } from 'react';
import type { AiChatView } from '@/lib/views/ai';

export interface AiChatProps {
  view: AiChatView;
  onAsk: (question: string) => void;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  className?: string;
}
