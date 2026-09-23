import { longDateLabel } from '@/lib/format';
import type { ArchiveSummary, CodexConfigData, CodexLiveData } from '@/types';
import type { StatusRow } from './types';

/** Limit-alert thresholds offered as toggles (100% — the limit itself — always alerts). */
export const THRESHOLD_CHOICES = [50, 60, 70, 80, 90, 95] as const;

/** Toggle one threshold, keeping the list sorted and never empty. */
export function toggleThreshold(current: number[], t: number): number[] {
  const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
  return next.length > 0 ? next.sort((a, b) => a - b) : current;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// `live` is /api/codex/live, `config` /api/codex/config; `dir` prefers /api/sources' `codex.dir` when sent.
export function codexStatusRows(
  config: CodexConfigData | null,
  live: CodexLiveData | null,
  dir: string | null,
): StatusRow[] {
  const rows: StatusRow[] = [];
  const apiKey = config?.authMode === 'apikey';

  rows.push(
    apiKey
      ? { label: 'Plan', value: 'OpenAI API key · pay-as-you-go', tone: 'muted' }
      : live?.planType
        ? { label: 'Plan', value: `ChatGPT ${titleCase(live.planType)} (detected)`, tone: 'ok' }
        : { label: 'Plan', value: 'Not detected', tone: 'muted' },
  );

  if (apiKey) {
    rows.push({ label: 'Token', value: 'API key login', note: 'An API key has no plan windows to read.', tone: 'muted' });
  } else if (config && config.authMode === null) {
    rows.push({ label: 'Token', value: 'Not signed in', note: 'No Codex login found in auth.json.', tone: 'warn' });
  } else if (!live) {
    rows.push({ label: 'Token', value: 'Checking…', tone: 'muted' });
  } else if (live.error) {
    const expired = /expired/i.test(live.error);
    rows.push({
      label: 'Token',
      value: expired ? 'Expired' : 'Live limits unavailable',
      note: expired
        ? 'Open the ChatGPT desktop app once — it refreshes its own token. The dashboard never refreshes it.'
        : live.error,
      tone: 'warn',
    });
  } else if (live.origin === 'passive') {
    rows.push({
      label: 'Token',
      value: 'Live read failed · using the newest local snapshot',
      note: live.warning,
      tone: 'warn',
    });
  } else {
    rows.push({ label: 'Token', value: 'OK', note: 'Live plan limits are being read.', tone: 'ok' });
  }

  rows.push({ label: 'Data folder', value: dir ?? '—', tone: 'muted' });
  return rows;
}

/** "3 archived files · 1.2 MB · since Mar 12, 2026" for the archive row. */
export function archiveLine(s: ArchiveSummary): string {
  const size = s.bytes >= 1_048_576 ? `${(s.bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(s.bytes / 1024))} KB`;
  const since = s.oldestTs !== null ? ` · since ${longDateLabel(s.oldestTs)}` : '';
  return `${s.files} archived file${s.files === 1 ? '' : 's'} · ${size}${since}`;
}
