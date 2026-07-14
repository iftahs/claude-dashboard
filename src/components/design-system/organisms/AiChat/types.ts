import type { AiConfig, AiStatus } from '@/types';
import type { SourceFilter } from '@/hooks/useSource';

export interface AiChatProps {
  status: AiStatus | null;
  config: AiConfig;
  /** Surface the header toggle is on — the chat answers over the same one. */
  source: SourceFilter;
  /** Persist a config change (e.g. model picked from the chat header). */
  onChangeConfig: (c: AiConfig) => void;
  onAsked: () => void;
  onOpenSettings: () => void;
}
