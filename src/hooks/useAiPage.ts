import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAiChat } from './useAiChat';
import { PROVIDER_LABELS, PROVIDER_MODELS } from './useAiConfig';
import { useAiInsightCtx } from './useAiInsightContext';
import { useSource } from './useSource';
import { track } from '@/lib/analytics';
import {
  AI_DAY_OPTIONS,
  AI_DEFAULT_DAYS,
  INTRO,
  SUGGESTIONS,
  modelPicker,
  serverBackend,
  setupView,
  type AiBackendView,
  type AiChatView,
  type AiDays,
  type AiModelPickerView,
  type AiOption,
} from '@/lib/views/ai';

export type AiNavigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => void;

export interface AiPageHeaderView {
  backend: AiBackendView | null;
  picker: AiModelPickerView | null;
  serverModel: string | null;
  dayOptions: readonly AiOption<AiDays>[];
  days: AiDays;
  canReset: boolean;
}

export interface AiPageView {
  description: string;
  header: AiPageHeaderView | null;
  chat: AiChatView;
  onDaysChange: (days: AiDays) => void;
  onModelChange: (model: string) => void;
  onReset: () => void;
  onAsk: (question: string) => void;
  onNavigate: AiNavigate;
}

const OWN_KEY_TITLE = 'Answers come from your own API key, set in Settings.';

export function useAiPage(): AiPageView {
  const navigate = useNavigate();
  const { aiStatus, aiConfig, setAiConfig } = useAiInsightCtx();
  const { effectiveSource, platform, codexAvailable } = useSource();
  const { messages, loading, suggestions, send, reset } = useAiChat();
  const [days, setDays] = useState<AiDays>(AI_DEFAULT_DAYS);

  // No ?source= means Both only when Codex exists; a Claude-only install is scoped as Claude.
  const source = effectiveSource ?? (codexAvailable ? 'all' : 'claude');

  // Warm the aggregate caches so the first question doesn't pay for a cold scan.
  useEffect(() => {
    void fetch(`/api/ai/context?source=${source}`).catch(() => {});
  }, [source]);

  const status = aiStatus.data ?? null;
  // A user-supplied key always counts as available, even if the server has no fallback.
  const unavailable = !aiConfig.apiKey && status?.available === 'none';
  const hasKey = Boolean(aiConfig.apiKey);

  const onAsk = useCallback(
    (question: string) => {
      if (!question.trim() || loading) return;
      track('ai_chat_asked');
      void send(question, aiConfig, { source, days: Number(days) });
    },
    [loading, send, aiConfig, source, days],
  );

  const onModelChange = useCallback(
    (model: string) => {
      if (model) setAiConfig({ ...aiConfig, model });
    },
    [setAiConfig, aiConfig],
  );

  const onNavigate = useCallback<AiNavigate>(
    (event, href) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(href);
    },
    [navigate],
  );

  const header = useMemo<AiPageHeaderView | null>(() => {
    if (unavailable) return null;
    const server = hasKey ? null : serverBackend(status);
    return {
      backend: hasKey ? { label: PROVIDER_LABELS[aiConfig.provider], title: OWN_KEY_TITLE } : server,
      picker: hasKey ? modelPicker(aiConfig.model, PROVIDER_MODELS[aiConfig.provider] ?? []) : null,
      serverModel: server && status?.model ? status.model : null,
      dayOptions: AI_DAY_OPTIONS,
      days,
      canReset: messages.length > 0,
    };
  }, [unavailable, hasKey, status, aiConfig.provider, aiConfig.model, days, messages.length]);

  const chat = useMemo<AiChatView>(
    () => ({
      setup: unavailable ? setupView(status) : null,
      messages,
      loading,
      starters: SUGGESTIONS[platform],
      followUps: suggestions,
      contextHref: `/api/ai/context?days=${days}&source=${source}`,
    }),
    [unavailable, status, messages, loading, platform, suggestions, days, source],
  );

  return { description: INTRO[platform], header, chat, onDaysChange: setDays, onModelChange, onReset: reset, onAsk, onNavigate };
}
