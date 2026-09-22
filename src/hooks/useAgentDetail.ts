import { useState, useCallback } from 'react';
import type { WorkflowAgentDetail } from '../types';

interface AgentDetailState {
  data: WorkflowAgentDetail | null;
  loading: boolean;
  error: string | null;
}

// Module-level caches so they survive re-renders
const cache = new Map<string, WorkflowAgentDetail>();
const inFlight = new Set<string>();

const keyOf = (runId: string, agentId: string) => `${runId}:${agentId}`;

/**
 * Fetch one workflow agent's detail on demand (row expand) — the endpoint parses a
 * whole transcript, so it must never be put on an interval like `usePolling`.
 * `force` skips the cache: a still-running agent's detail keeps changing.
 */
export function useAgentDetail(): {
  getAgentDetail: (runId: string, agentId: string, force?: boolean) => void;
  states: Map<string, AgentDetailState>;
} {
  const [states, setStates] = useState<Map<string, AgentDetailState>>(new Map());

  const getAgentDetail = useCallback((runId: string, agentId: string, force = false) => {
    const key = keyOf(runId, agentId);

    // Serve from cache immediately
    if (!force && cache.has(key)) {
      setStates((prev) => {
        if (prev.get(key)?.data) return prev; // already in state
        const next = new Map(prev);
        next.set(key, { data: cache.get(key)!, loading: false, error: null });
        return next;
      });
      return;
    }

    // Deduplicate in-flight requests
    if (inFlight.has(key)) return;
    inFlight.add(key);

    setStates((prev) => {
      const next = new Map(prev);
      next.set(key, { data: prev.get(key)?.data ?? null, loading: true, error: null });
      return next;
    });

    fetch(`/api/workflows/${encodeURIComponent(runId)}/agents/${encodeURIComponent(agentId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((env: { data: WorkflowAgentDetail }) => {
        const detail = env.data;
        cache.set(key, detail);
        inFlight.delete(key);
        setStates((prev) => {
          const next = new Map(prev);
          next.set(key, { data: detail, loading: false, error: null });
          return next;
        });
      })
      .catch((e: unknown) => {
        inFlight.delete(key);
        setStates((prev) => {
          const next = new Map(prev);
          next.set(key, { data: null, loading: false, error: String(e) });
          return next;
        });
      });
  }, []); // stable — no reactive deps needed

  return { getAgentDetail, states };
}
