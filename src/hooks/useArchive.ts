import { useState } from 'react';
import { usePolling } from './usePolling';
import type { ArchiveSummary, Envelope } from '../types';

// forget() POSTs a JSON body (the server's CSRF guard requires one on every write); its response shows until a newer poll lands.
export function useArchive() {
  const poll = usePolling<ArchiveSummary>('/api/archive', 60_000);
  const [after, setAfter] = useState<{ summary: ArchiveSummary; at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = after && after.at >= (poll.computedAt ?? 0) ? after.summary : poll.data;

  async function forget() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/archive/forget', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const body = (await res.json().catch(() => null)) as (Envelope<ArchiveSummary> & { error?: string }) | null;
      if (!res.ok || !body?.data) throw new Error(body?.error || `HTTP ${res.status}`);
      setAfter({ summary: body.data, at: body.computedAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return { summary, loading: poll.loading, busy, error, forget };
}
