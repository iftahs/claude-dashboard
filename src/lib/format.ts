export function compact(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + 'K';
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0) + 'M';
  return (n / 1_000_000_000).toFixed(1) + 'B';
}

export function usd(n: number): string {
  if (n < 0.01) return '$' + n.toFixed(4);
  if (n < 100) return '$' + n.toFixed(2);
  return '$' + Math.round(n).toLocaleString();
}

export function shortModel(model: string): string {
  return model
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
    .replace(/-(\d)-(\d)$/, ' $1.$2')
    .replace(/-(\d)$/, ' $1'); // single-digit generations: opus-5 → "opus 5"
}

/** `mcp__chrome-devtools__click` → `chrome-devtools · click`; builtin names unchanged. */
export function toolLabel(name: string): string {
  const m = name.match(/^mcp__(.+)__([^_]+(?:_[^_]+)*)$/);
  if (!m) return name;
  return `${m[1].replace(/^claude_ai_/, '').replace(/_/g, ' ')} · ${m[2]}`;
}

/**
 * A logged reasoning-effort level as UI text: `xhigh` → `X-high`, `unknown` (no
 * effort in the log) → `Not logged`; anything else is capitalised as logged.
 */
export function effortLabel(effort: string): string {
  if (effort === 'unknown' || !effort) return 'Not logged';
  if (effort === 'xhigh') return 'X-high';
  return effort.charAt(0).toUpperCase() + effort.slice(1);
}

/**
 * "Sep 22" (or "Sep 22 '26") for a YYYY-MM-DD key. The key is read as a calendar
 * date, not a timestamp, so a UTC-day key and a local-day key label the same way.
 */
export function ymdLabel(key: string, withYear = false): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  const dt = new Date(y, m - 1, d);
  const md = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return withYear ? `${md} '${String(y).slice(-2)}` : md;
}

/** "Sep 22, 2026" for an epoch-ms timestamp — first-seen dates, "since …" labels. */
export function longDateLabel(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function hourLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric' });
}

export function dayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Sep 22 '26" — for day axes spanning more than ~2 months, where a bare
 *  "Mon, Sep 22" could be either year. */
export function dayLabelWithYear(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} '${String(d.getFullYear()).slice(-2)}`;
}

export function dateTimeLabel(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

/** Relative inside 24h, absolute date+time beyond it — "385h ago" is unreadable. */
export function timeAgoOrDate(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return dateTimeLabel(ms);
}

export function untilLabel(ms: number): string {
  const s = Math.max(0, Math.round((ms - Date.now()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function untilFull(ms: number): string {
  const s = Math.max(0, Math.round((ms - Date.now()) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
