import type { AiConfig, AiStatus } from '@/types';

export interface AiChatProps {
  status: AiStatus | null;
  config: AiConfig;
  /** Persist a config change (e.g. model picked from the chat header). */
  onChangeConfig: (c: AiConfig) => void;
  onAsked: () => void;
  onOpenSettings: () => void;
}
