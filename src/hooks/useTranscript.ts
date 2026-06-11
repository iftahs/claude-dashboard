import { useState, useCallback } from 'react';
import type { SessionTranscript } from '../types';

interface TranscriptState {
  data: SessionTranscript | null;
  loading: boolean;
  error: string | null;
}

// Module-level caches so they survive re-renders
const cache = new Map<string, SessionTranscript>();
const inFlight = new Set<string>();

export function useTranscript(): {
  getTranscript: (sessionId: string) => void;
  states: Map<string, TranscriptState>;
} {
  const [states, setStates] = useState<Map<string, TranscriptState>>(new Map());

  const getTranscript = useCallback((sessionId: string) => {
    // Serve from cache immediately
    if (cache.has(sessionId)) {
      setStates((prev) => {
        if (prev.get(sessionId)?.data) return prev; // already in state
        const next = new Map(prev);
        next.set(sessionId, { data: cache.get(sessionId)!, loading: false, error: null });
        return next;
      });
      return;
    }

    // Deduplicate in-flight requests
    if (inFlight.has(sessionId)) return;
    inFlight.add(sessionId);

    setStates((prev) => {
      const next = new Map(prev);
      next.set(sessionId, { data: null, loading: true, error: null });
      return next;
    });

    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/transcript`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((env: { data: SessionTranscript }) => {
        const transcript = env.data;
        cache.set(sessionId, transcript);
        inFlight.delete(sessionId);
        setStates((prev) => {
          const next = new Map(prev);
          next.set(sessionId, { data: transcript, loading: false, error: null });
          return next;
        });
      })
      .catch((e: unknown) => {
        inFlight.delete(sessionId);
        setStates((prev) => {
          const next = new Map(prev);
          next.set(sessionId, { data: null, loading: false, error: String(e) });
          return next;
        });
      });
  }, []); // stable — no reactive deps needed

  return { getTranscript, states };
}
