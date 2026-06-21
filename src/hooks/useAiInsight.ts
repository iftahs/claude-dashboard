import { useRef, useState } from 'react';
import type { AiBackend, AiConfig, AiInsightResponse, Envelope } from '../types';

export interface AiInsightState {
  text: string | null;
  backend?: AiBackend;
  loading: boolean;
  error: string | null;
}

const EMPTY: AiInsightState = { text: null, loading: false, error: null };

/**
 * Per-section AI insight state. `run(section, data)` POSTs the already-fetched
 * aggregate to /api/ai/insight; results are cached per section so re-opening is
 * instant. In-flight clicks are de-duped.
 */
export function useAiInsight() {
  const [states, setStates] = useState<Map<string, AiInsightState>>(new Map());
  const inflight = useRef<Set<string>>(new Set());

  const patch = (section: string, p: Partial<AiInsightState>) =>
    setStates((prev) => {
      const m = new Map(prev);
      m.set(section, { ...(m.get(section) ?? EMPTY), ...p });
      return m;
    });

  async function run(section: string, data: unknown, config?: AiConfig) {
    if (inflight.current.has(section)) return;
    inflight.current.add(section);
    patch(section, { loading: true, error: null });
    try {
      const res = await fetch('/api/ai/insight', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ section, data, config: config?.apiKey ? config : undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const env = body as Envelope<AiInsightResponse>;
      patch(section, { loading: false, text: env.data.insight, backend: env.data.backend, error: null });
    } catch (e) {
      patch(section, { loading: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      inflight.current.delete(section);
    }
  }

  function dismiss(section: string) {
    setStates((prev) => {
      const m = new Map(prev);
      m.delete(section);
      return m;
    });
  }

  return { states, run, dismiss };
}
