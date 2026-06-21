import { useCallback, useState } from 'react';
import type { AiConfig, AiProvider } from '../types';

const KEY = 'claude-dashboard-ai-config-v1';

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  claude: 'Claude (Anthropic)',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
};

export const PROVIDER_MODELS: Record<AiProvider, string[]> = {
  claude: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
};

const DEFAULT: AiConfig = { provider: 'claude', model: PROVIDER_MODELS.claude[0], apiKey: '' };

function load(): AiConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw);
    const provider: AiProvider = p?.provider in PROVIDER_MODELS ? p.provider : 'claude';
    return {
      provider,
      model: typeof p?.model === 'string' && p.model ? p.model : PROVIDER_MODELS[provider][0],
      apiKey: typeof p?.apiKey === 'string' ? p.apiKey : '',
    };
  } catch {
    return DEFAULT;
  }
}

/**
 * AI Insights credentials, persisted in localStorage (client-side only — a local
 * dashboard on the user's own machine). Sent per-request to the backend proxy.
 */
export function useAiConfig(): [AiConfig, (next: AiConfig) => void, () => void] {
  const [config, setConfig] = useState<AiConfig>(load);

  const save = useCallback((next: AiConfig) => {
    setConfig(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / disabled storage */
    }
  }, []);

  const clear = useCallback(() => {
    setConfig({ ...DEFAULT });
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return [config, save, clear];
}
