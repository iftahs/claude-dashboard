import type { AiConfig, AiStatus } from '@/types';
import type { Platform, SourceFilter } from '@/hooks/useSource';

export interface AiChatProps {
  status: AiStatus | null;
  config: AiConfig;
  /** The `?source=` the AI context is scoped to — the platform/surface the dashboard shows right now. */
  source: SourceFilter | 'claude';
  /** The header platform — picks the intro copy and the starter questions. */
  platform: Platform;
  /** Persist a config change (e.g. model picked from the chat header). */
  onChangeConfig: (c: AiConfig) => void;
  onAsked: () => void;
  onOpenSettings: () => void;
}
