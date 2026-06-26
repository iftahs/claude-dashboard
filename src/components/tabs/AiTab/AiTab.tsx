import { useNavigate } from 'react-router-dom';
import { AiChat } from '@/components/design-system/organisms/AiChat/AiChat';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import { track } from '@/lib/analytics';

export function AiTab() {
  const navigate = useNavigate();
  const { aiStatus, aiConfig, setAiConfig } = useAiInsightCtx();
  return (
    <AiChat
      status={aiStatus.data ?? null}
      config={aiConfig}
      onChangeConfig={setAiConfig}
      onAsked={() => track('ai_chat_asked')}
      onOpenSettings={() => navigate('/settings')}
    />
  );
}
