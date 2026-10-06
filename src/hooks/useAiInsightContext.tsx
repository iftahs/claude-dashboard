import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAiStatus } from './useAiStatus';
import { useAiConfig } from './useAiConfig';
import { useAiInsight } from './useAiInsight';
import type { PollState } from './usePolling';
import { track } from '../lib/analytics';
import { aiBackendLabel } from '../lib/section';
import type { SectionAi } from '../lib/section';
import type { AiConfig, AiStatus } from '../types';

interface AiInsightCtx {
  aiConfig: AiConfig;
  setAiConfig: (c: AiConfig) => void;
  aiStatus: PollState<AiStatus>;
  sectionAi: (section: string, data: unknown) => SectionAi;
}

const AiInsightContext = createContext<AiInsightCtx | null>(null);

export function AiInsightProvider({ children }: { children: ReactNode }) {
  const aiStatus = useAiStatus();
  const [aiConfig, setAiConfig] = useAiConfig();
  const ai = useAiInsight();
  // Available if the user set a key in Settings, or the server has a fallback (CLI/token).
  const aiDisabled = !aiConfig.apiKey && aiStatus.data?.available === 'none';

  const value = useMemo<AiInsightCtx>(() => {
    const sectionAi = (section: string, data: unknown): SectionAi => {
      const s = ai.states.get(section);
      return {
        onAsk: () => {
          track('ai_insight_clicked', { section });
          ai.run(section, data, aiConfig);
        },
        loading: s?.loading ?? false,
        disabled: aiDisabled,
        result: s
          ? {
              text: s.text ?? undefined,
              loading: s.loading,
              error: s.error ?? undefined,
              backendLabel: aiBackendLabel(s.backend),
              onDismiss: () => ai.dismiss(section),
            }
          : null,
      };
    };
    return { aiConfig, setAiConfig, aiStatus, sectionAi };
  }, [ai, aiConfig, setAiConfig, aiStatus, aiDisabled]);

  return <AiInsightContext.Provider value={value}>{children}</AiInsightContext.Provider>;
}

export function useAiInsightCtx(): AiInsightCtx {
  const ctx = useContext(AiInsightContext);
  if (!ctx) throw new Error('useAiInsightCtx must be used within an AiInsightProvider');
  return ctx;
}
