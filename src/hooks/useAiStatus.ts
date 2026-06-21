import { usePolling } from './usePolling';
import type { AiStatus } from '../types';

/** Polls which AI backend is available (cli / api / apikey / none). Slow — 5 min. */
export function useAiStatus() {
  return usePolling<AiStatus>('/api/ai/status', 300000);
}
