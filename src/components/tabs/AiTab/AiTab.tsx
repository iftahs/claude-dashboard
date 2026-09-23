import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiChat } from '@/components/design-system/organisms/AiChat/AiChat';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import { useSource } from '@/hooks/useSource';
import { track } from '@/lib/analytics';

export function AiTab() {
  const navigate = useNavigate();
  const { aiStatus, aiConfig, setAiConfig } = useAiInsightCtx();
  // Scope the AI context to what the dashboard shows: the platform (claude/codex) or a Claude surface.
  // The server picks the limits block, the datasets and the prompt wording from it.
  const { effectiveSource, platform } = useSource();
  const source = effectiveSource ?? 'all';

  // Warm the aggregate caches so the first question doesn't pay for a cold scan.
  useEffect(() => {
    void fetch(`/api/ai/context?source=${source}`).catch(() => {});
  }, [source]);

  return (
    <AiChat
      status={aiStatus.data ?? null}
      config={aiConfig}
      source={source}
      platform={platform}
      onChangeConfig={setAiConfig}
      onAsked={() => track('ai_chat_asked')}
      onOpenSettings={() => navigate('/settings')}
    />
  );
}
