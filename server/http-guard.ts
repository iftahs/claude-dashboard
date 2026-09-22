/**
 * http-guard.ts — the request/response rules that keep a local-only API local.
 *
 * The dashboard has no login, so "who may call it" is decided by where the
 * request comes from:
 *
 *   - Host check (DNS rebinding). A page on evil.example can re-point its own
 *     hostname at 127.0.0.1 and then read our API "same-origin". The browser
 *     still sends `Host: evil.example`, so only loopback names (plus whatever the
 *     user lists in ALLOWED_HOSTS for LAN access) are served.
 *   - Write check (CSRF). A cross-site <form> can POST text/plain or urlencoded
 *     bodies without a preflight. Requiring `application/json` forces a CORS
 *     preflight we never answer, and a present Origin must name an allowed host.
 *
 * Only the HOSTNAME is compared, never the port: the Vite dev proxy forwards the
 * browser's `Host: localhost:5180` unchanged, and the same page reaches the API
 * on 8787 (Docker) or 8788 (dev).
 *
 * Pure functions only — index.ts wires them into Express middleware.
 */

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1'];

/** Loopback names plus the comma-separated ALLOWED_HOSTS list (hostnames or IPs). */
export function allowedHosts(raw: string | undefined): Set<string> {
  const out = new Set(LOOPBACK_HOSTS);
  for (const part of (raw ?? '').split(',')) {
    const h = normalizeHostname(part);
    if (h) out.add(h);
  }
  return out;
}

/** Lowercase, drop a trailing dot and IPv6 brackets. '' when nothing is left. */
function normalizeHostname(raw: string): string {
  let h = raw.trim().toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (h.endsWith('.')) h = h.slice(0, -1);
  return h;
}

/**
 * Hostname of a `Host` header: `localhost:5180` → `localhost`, `[::1]:8787` →
 * `::1`. A bare IPv6 literal without brackets is invalid in a Host header, but
 * it is kept whole rather than mis-split on its last colon. null when absent.
 */
export function hostHeaderName(host: string | undefined): string | null {
  if (!host) return null;
  let h = host.trim();
  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    if (end < 0) return null;
    h = h.slice(1, end);
  } else if (h.indexOf(':') === h.lastIndexOf(':')) {
    h = h.split(':')[0];
  }
  return normalizeHostname(h) || null;
}

/** Hostname of an `Origin` header. null for the opaque `null` origin or junk. */
export function originHostname(origin: string): string | null {
  try {
    return normalizeHostname(new URL(origin).hostname) || null;
  } catch {
    return null;
  }
}

export interface GuardRequest {
  method: string;
  host: string | undefined;
  origin: string | undefined;
  contentType: string | undefined;
}

export interface GuardRejection {
  status: number;
  error: string;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * null when the request may proceed, else the status + message to send. The
 * write rules apply to every unsafe method on every path, not to an `/api`
 * prefix — Express matches routes case-insensitively, so `/API/update/pull`
 * would slip past a prefix test and still hit the handler.
 */
export function checkRequest(req: GuardRequest, allowed: ReadonlySet<string>): GuardRejection | null {
  const host = hostHeaderName(req.host);
  if (!host || !allowed.has(host)) {
    return {
      status: 403,
      error: `Host "${host ?? ''}" is not allowed. Open the dashboard via localhost, or add this hostname to ALLOWED_HOSTS.`,
    };
  }
  if (SAFE_METHODS.has(req.method.toUpperCase())) return null;

  const mediaType = (req.contentType ?? '').split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return { status: 415, error: 'Write requests must be sent as application/json.' };
  }
  if (req.origin !== undefined) {
    const origin = originHostname(req.origin);
    if (!origin || !allowed.has(origin)) {
      return { status: 403, error: 'Cross-origin write requests are not allowed.' };
    }
  }
  return null;
}

// ── What /api/config may expose ───────────────────────────────────────────────

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const strings = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;
const record = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

/**
 * The settings.json fields the UI renders (ConfigProfile), projected one by one.
 * NEVER spread settings.json into a response: it routinely carries an `env`
 * block with API keys, an `apiKeyHelper` command and hook commands. Marketplace
 * entries are reduced to their names (only the count is shown; their sources can
 * be private git URLs), and enabled plugins to booleans.
 */
export function publicSettings(settings: unknown) {
  const s = record(settings) ?? {};
  const perms = record(s.permissions);
  const plugins = record(s.enabledPlugins);
  const marketplaces = record(s.extraKnownMarketplaces);
  return {
    model: str(s.model),
    effortLevel: str(s.effortLevel),
    autoUpdatesChannel: str(s.autoUpdatesChannel),
    voiceEnabled: bool(s.voiceEnabled),
    remoteControlAtStartup: bool(s.remoteControlAtStartup),
    inputNeededNotifEnabled: bool(s.inputNeededNotifEnabled),
    agentPushNotifEnabled: bool(s.agentPushNotifEnabled),
    enabledPlugins: plugins
      ? Object.fromEntries(Object.entries(plugins).map(([k, v]) => [k, Boolean(v)]))
      : undefined,
    extraKnownMarketplaces: marketplaces
      ? Object.fromEntries(Object.keys(marketplaces).map((k) => [k, true]))
      : undefined,
    permissions: perms
      ? {
          defaultMode: str(perms.defaultMode),
          allow: strings(perms.allow),
          additionalDirectories: strings(perms.additionalDirectories),
        }
      : undefined,
  };
}
