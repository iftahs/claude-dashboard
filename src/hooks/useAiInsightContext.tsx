import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAiStatus } from './useAiStatus';
import { useAiConfig } from './useAiConfig';
import { useAiInsight } from './useAiInsight';
import type { PollState } from './usePolling';
import { AiInsightInline } from '@/components/design-system/molecules/AiInsightInline/AiInsightInline';
import { track } from '../lib/analytics';
import type { AiConfig, AiStatus } from '../types';

/** Props bundle a <Section> needs to render its AI-insight affordance. */
export interface SectionAiProps {
  aiSection: string;
  aiDisabled: boolean;
  aiLoading: boolean | undefined;
  onAiInsight: () => void;
  aiInsight: ReactNode;
}

interface AiInsightCtx {
  ai: ReturnType<typeof useAiInsight>;
  aiConfig: AiConfig;
  setAiConfig: (c: AiConfig) => void;
  aiStatus: PollState<AiStatus>;
  aiDisabled: boolean;
  onAiInsight: (section: string, data: unknown) => void;
  aiInline: (section: string) => ReactNode;
  /** One call yields every AI prop a <Section> needs — spread it in. */
  aiProps: (section: string, data: unknown) => SectionAiProps;
}

const AiInsightContext = createContext<AiInsightCtx | null>(null);

/**
 * Per-section AI insights: which backend is available, the user's key/model,
 * and the run/dismiss machinery. `aiProps(section, data)` collapses the
 * five-prop bundle every insight-enabled <Section> used to spell out by hand.
 */
export function AiInsightProvider({ children }: { children: ReactNode }) {
  const aiStatus = useAiStatus();
  const [aiConfig, setAiConfig] = useAiConfig();
  const ai = useAiInsight();
  // Available if the user set a key in Settings, or the server has a fallback (CLI/token).
  const aiDisabled = !aiConfig.apiKey && aiStatus.data?.available === 'none';

  const value = useMemo<AiInsightCtx>(() => {
    const onAiInsight = (section: string, data: unknown) => {
      track('ai_insight_clicked', { section });
      ai.run(section, data, aiConfig);
    };
    const aiInline = (section: string): ReactNode => {
      const s = ai.states.get(section);
      if (!s) return null;
      return (
        <AiInsightInline
          text={s.text ?? undefined}
          loading={s.loading}
          error={s.error ?? undefined}
          backend={s.backend}
          onDismiss={() => ai.dismiss(section)}
        />
      );
    };
    const aiProps = (section: string, data: unknown): SectionAiProps => ({
      aiSection: section,
      aiDisabled,
      aiLoading: ai.states.get(section)?.loading,
      onAiInsight: () => onAiInsight(section, data),
      aiInsight: aiInline(section),
    });
    return { ai, aiConfig, setAiConfig, aiStatus, aiDisabled, onAiInsight, aiInline, aiProps };
  }, [ai, aiConfig, setAiConfig, aiStatus, aiDisabled]);

  return <AiInsightContext.Provider value={value}>{children}</AiInsightContext.Provider>;
}

export function useAiInsightCtx(): AiInsightCtx {
  const ctx = useContext(AiInsightContext);
  if (!ctx) throw new Error('useAiInsightCtx must be used within an AiInsightProvider');
  return ctx;
}
