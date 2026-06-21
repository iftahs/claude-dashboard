import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiConfig } from '../types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  error?: boolean;
}

const STORE_KEY = 'claude-dashboard-ai-chat-v1';
const MAX_STORED = 50;

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

/**
 * Multi-turn AI chat over usage aggregates. Sends a bounded history each turn,
 * and persists the transcript to localStorage so it survives tab switches and
 * reloads (the AI sees prior turns; the user sees them again on return).
 */
type Turn = { role: 'user' | 'assistant'; content: string };

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [messages]);

  // Ask the model for conversation-aware follow-up chips. Best-effort: failures
  // just leave the static fallback suggestions in place.
  const fetchSuggestions = useCallback(
    async (history: Turn[], config: AiConfig | undefined, ac: AbortController) => {
      try {
        const res = await fetch('/api/ai/suggestions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ history, config: config?.apiKey ? config : undefined }),
          signal: ac.signal,
        });
        if (!res.ok) return;
        const b = await res.json();
        const s = b?.data?.suggestions;
        if (Array.isArray(s)) setSuggestions(s.filter((x: unknown): x is string => typeof x === 'string').slice(0, 4));
      } catch {
        /* ignore — keep fallback suggestions */
      }
    },
    [],
  );

  const send = useCallback(
    async (question: string, config?: AiConfig) => {
      const q = question.trim();
      if (!q || loading) return;
      const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
      const assistantTs = Date.now() + 1; // distinct from the user message ts
      setMessages((m) => [
        ...m,
        { role: 'user', content: q, ts: Date.now() },
        { role: 'assistant', content: '', ts: assistantTs },
      ]);
      setLoading(true);
      setSuggestions([]); // clear stale chips while the next answer streams
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;

      const patchAssistant = (fn: (a: ChatMessage) => ChatMessage) =>
        setMessages((m) => {
          const c = [...m];
          const i = c.findIndex((x) => x.role === 'assistant' && x.ts === assistantTs);
          if (i >= 0) c[i] = fn(c[i]);
          return c;
        });

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: q, history, config: config?.apiKey ? config : undefined }),
          signal: ac.signal,
        });
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const b = await res.json();
            if (b?.error) msg = b.error;
          } catch {
            /* non-JSON error body */
          }
          throw new Error(msg);
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream');
        const dec = new TextDecoder();
        let acc = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          patchAssistant((a) => ({ ...a, content: acc }));
        }
        const tail = dec.decode(); // flush a multi-byte char split across the last chunk
        if (tail) {
          acc += tail;
          patchAssistant((a) => ({ ...a, content: acc }));
        }
        if (!acc.trim()) {
          patchAssistant((a) => ({ ...a, content: 'Empty response from the model.', error: true }));
        } else {
          const finalHistory: Turn[] = [...history, { role: 'user', content: q }, { role: 'assistant', content: acc }];
          void fetchSuggestions(finalHistory, config, ac);
        }
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        const msg = e instanceof Error ? e.message : String(e);
        patchAssistant((a) => ({ ...a, content: msg, error: true }));
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, fetchSuggestions],
  );

  const reset = useCallback(() => {
    abort.current?.abort();
    setMessages([]);
    setSuggestions([]);
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { messages, loading, suggestions, send, reset };
}
