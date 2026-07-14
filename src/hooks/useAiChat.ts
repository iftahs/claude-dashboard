import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiConfig } from '../types';
import type { SourceFilter } from './useSource';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  error?: boolean;
  /** Which datasets the backend routed this answer to (X-AI-Datasets), for the footnote. */
  datasets?: string[];
}

/** The window + surface the chat answers over — mirrors what the user is looking at. */
export interface AiScope {
  source: SourceFilter;
  days: number;
}

const STORE_KEY = 'claude-dashboard-ai-chat-v1';
const MAX_STORED = 50;

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const a = JSON.parse(raw);
    if (!Array.isArray(a)) return [];
    // transcripts persisted before `id` existed get one backfilled on load
    return (a as ChatMessage[]).map((m) => (m.id ? m : { ...m, id: crypto.randomUUID() }));
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
  const sending = useRef(false); // synchronous re-entrancy guard — `loading` state lags a fast double-click

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
    async (history: Turn[], config: AiConfig | undefined, scope: AiScope, ac: AbortController) => {
      try {
        const res = await fetch('/api/ai/suggestions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ history, ...scope, config: config?.apiKey ? config : undefined }),
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
    async (question: string, config: AiConfig | undefined, scope: AiScope) => {
      const q = question.trim();
      if (!q || sending.current) return;
      sending.current = true;
      // an empty assistant turn is garbage context — never send it back to the model
      const history = messages.filter((m) => !m.error && m.content).map((m) => ({ role: m.role, content: m.content }));
      const now = Date.now(); // hoisted: the setMessages updater must stay pure (StrictMode double-invokes it)
      const user: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: q, ts: now };
      const assistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', ts: now + 1 };
      setMessages((m) => [...m, user, assistant]);
      setLoading(true);
      setSuggestions([]); // clear stale chips while the next answer streams
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;

      const patchAssistant = (fn: (a: ChatMessage) => ChatMessage) =>
        setMessages((m) => {
          const c = [...m];
          const i = c.findIndex((x) => x.id === assistant.id);
          if (i >= 0) c[i] = fn(c[i]);
          return c;
        });

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: q, history, ...scope, config: config?.apiKey ? config : undefined }),
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
        // Which datasets the router pulled — the only way to see why an answer
        // came out the way it did (there is no HMR and no test suite here).
        const routed = (res.headers.get('X-AI-Datasets') ?? '').split(',').filter(Boolean);
        if (routed.length > 0) patchAssistant((a) => ({ ...a, datasets: routed }));
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
          void fetchSuggestions(finalHistory, config, scope, ac);
        }
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') {
          // drop the orphaned bubble — an empty assistant message renders as a stuck "thinking…"
          setMessages((m) => m.filter((x) => x.id !== assistant.id || x.content));
          return;
        }
        const msg = e instanceof Error ? e.message : String(e);
        patchAssistant((a) => ({ ...a, content: msg, error: true }));
      } finally {
        sending.current = false;
        setLoading(false);
      }
    },
    [messages, fetchSuggestions],
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
