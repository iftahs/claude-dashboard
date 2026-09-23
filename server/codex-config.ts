import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { codexDir } from './scan.ts';

// ── Scanner ────────────────────────────────────────────────────────────────────

export interface TomlVisitor {
  /** A `[table]` header. Array-of-tables headers (`[[x]]`) get a trailing '[]' segment. */
  table?: (path: string[]) => void;
  /** A `key = value` line; `path` is the full path (table + dotted key), `raw` the undecoded value text. */
  entry?: (path: string[], raw: string) => void;
}

const BARE_KEY = /[A-Za-z0-9_-]/;

/** Index just past a basic ("…") string starting at `i` (the opening quote), honouring escapes. */
function endOfBasic(s: string, i: number): number {
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') j++;
    else if (c === '"' || c === '\n') return j + 1;
  }
  return s.length;
}

/** Index just past a literal ('…') string starting at `i`. */
function endOfLiteral(s: string, i: number): number {
  for (let j = i + 1; j < s.length; j++) if (s[j] === "'" || s[j] === '\n') return j + 1;
  return s.length;
}

/** Index just past a multi-line string (""" or ''') starting at `i`. */
function endOfMultiline(s: string, i: number, quote: '"""' | "'''"): number {
  for (let j = i + 3; j < s.length; j++) {
    if (quote === '"""' && s[j] === '\\') {
      j++;
      continue;
    }
    if (s.startsWith(quote, j)) {
      // A closing delimiter may be followed by up to two more quotes that belong to the content.
      let k = j + 3;
      while (k < s.length && s[k] === quote[0] && k < j + 5) k++;
      return k;
    }
  }
  return s.length;
}

/** Index just past whatever string starts at `i`, or null when none does. */
function endOfString(s: string, i: number): number | null {
  if (s.startsWith('"""', i)) return endOfMultiline(s, i, '"""');
  if (s.startsWith("'''", i)) return endOfMultiline(s, i, "'''");
  if (s[i] === '"') return endOfBasic(s, i);
  if (s[i] === "'") return endOfLiteral(s, i);
  return null;
}

/** End of a value at `i`: a string, a balanced bracket/brace group (strings and comments inside respected), or a scalar up to the first `stops` char. */
function endOfValue(s: string, i: number, stops = '\n#'): number {
  const str = endOfString(s, i);
  if (str !== null) return str;
  if (s[i] === '[' || s[i] === '{') {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      const e = endOfString(s, j);
      if (e !== null) {
        j = e - 1;
        continue;
      }
      if (c === '#') {
        const nl = s.indexOf('\n', j);
        j = nl === -1 ? s.length : nl;
        continue;
      }
      if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') {
        depth--;
        if (depth === 0) return j + 1;
      }
    }
    return s.length;
  }
  let j = i;
  while (j < s.length && !stops.includes(s[j])) j++;
  return j;
}

/** Decode a key segment ("quoted", 'literal' or bare) starting at `i`. */
function readKeySegment(s: string, i: number): { key: string; end: number } | null {
  if (s[i] === '"') {
    const end = endOfBasic(s, i);
    const key = decodeBasic(s.slice(i + 1, end - 1));
    return key === null ? null : { key, end };
  }
  if (s[i] === "'") {
    const end = endOfLiteral(s, i);
    return { key: s.slice(i + 1, end - 1), end };
  }
  let j = i;
  while (j < s.length && BARE_KEY.test(s[j])) j++;
  return j > i ? { key: s.slice(i, j), end: j } : null;
}

function skipBlanks(s: string, i: number): number {
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
  return i;
}

/** A dotted key (`a."b".c`) starting at `i`, stopping before `stop` (']' or '='). */
function readKeyPath(s: string, i: number): { path: string[]; end: number } | null {
  const path: string[] = [];
  let j = skipBlanks(s, i);
  for (;;) {
    const seg = readKeySegment(s, j);
    if (!seg) return null;
    path.push(seg.key);
    j = skipBlanks(s, seg.end);
    if (s[j] !== '.') return { path, end: j };
    j = skipBlanks(s, j + 1);
  }
}

/** Walks a TOML document reporting every table/key-value WITHOUT decoding values; never throws — unparseable lines are just skipped. */
export function scanToml(text: string, visit: TomlVisitor): void {
  const s = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  let table: string[] = [];
  let i = 0;
  const nextLine = (from: number) => {
    const nl = s.indexOf('\n', from);
    return nl === -1 ? s.length : nl + 1;
  };
  while (i < s.length) {
    i = skipBlanks(s, i);
    const c = s[i];
    if (c === undefined) break;
    if (c === '\n') {
      i++;
      continue;
    }
    if (c === '#') {
      i = nextLine(i);
      continue;
    }
    if (c === '[') {
      const isArray = s[i + 1] === '[';
      const kp = readKeyPath(s, i + (isArray ? 2 : 1));
      if (kp && s[kp.end] === ']' && (!isArray || s[kp.end + 1] === ']')) {
        table = isArray ? [...kp.path, '[]'] : kp.path;
        visit.table?.(table);
      } else {
        table = ['[invalid]'];
      }
      i = nextLine(i);
      continue;
    }
    const kp = readKeyPath(s, i);
    if (!kp || s[kp.end] !== '=') {
      i = nextLine(i);
      continue;
    }
    const start = skipBlanks(s, kp.end + 1);
    const end = endOfValue(s, start);
    visit.entry?.([...table, ...kp.path], s.slice(start, end).trim());
    i = nextLine(Math.max(end - 1, start));
  }
}

function decodeBasic(body: string): string | null {
  let out = '';
  for (let j = 0; j < body.length; j++) {
    const c = body[j];
    if (c !== '\\') {
      out += c;
      continue;
    }
    const n = body[++j];
    if (n === 'n') out += '\n';
    else if (n === 't') out += '\t';
    else if (n === 'r') out += '\r';
    else if (n === 'b') out += '\b';
    else if (n === 'f') out += '\f';
    else if (n === '"' || n === '\\') out += n;
    else if (n === 'u' || n === 'U') {
      const len = n === 'u' ? 4 : 8;
      const cp = parseInt(body.slice(j + 1, j + 1 + len), 16);
      if (!Number.isFinite(cp)) return null;
      try {
        out += String.fromCodePoint(cp);
      } catch {
        return null;
      }
      j += len;
    } else return null;
  }
  return out;
}

/** A single-line basic or literal string value, or null for anything else. */
export function tomlString(raw: string): string | null {
  const v = raw.trim();
  if (v.startsWith('"""') || v.startsWith("'''")) return null;
  if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') return decodeBasic(v.slice(1, -1));
  if (v.length >= 2 && v[0] === "'" && v[v.length - 1] === "'") return v.slice(1, -1);
  return null;
}

export function tomlBool(raw: string): boolean | null {
  const v = raw.trim();
  return v === 'true' ? true : v === 'false' ? false : null;
}

/** Only `command` from an inline table (`{ command=…, args=[…] }`) — other keys are located but never decoded. */
function inlineCommand(raw: string): string | null {
  const v = raw.trim();
  if (!v.startsWith('{')) return null;
  const body = v.slice(1, v.endsWith('}') ? -1 : undefined);
  let command: string | null = null;
  let i = 0;
  for (;;) {
    while (i < body.length && /[\s,]/.test(body[i])) i++;
    if (i >= body.length) break;
    const kp = readKeyPath(body, i);
    if (!kp || body[kp.end] !== '=') break;
    const start = skipBlanks(body, kp.end + 1);
    const end = endOfValue(body, start, '\n#,}');
    if (kp.path.length === 1 && kp.path[0] === 'command') command = tomlString(body.slice(start, end));
    i = Math.max(end, start + 1);
  }
  return command;
}

/** A Windows program path that may contain spaces (`C:\Program Files\…\node.exe`), with no args or quotes in it. */
const WINDOWS_PROGRAM = /^((?:(?! -)[^'"])*?\.(?:exe|cmd|bat|com))(?=\s|$)/i;

/** Program name only — never the directory or anything after it (inline args could carry a token). */
export function commandBasename(command: string | null): string | null {
  const c = command?.trim();
  if (!c) return null;
  const program = c.match(WINDOWS_PROGRAM)?.[1] ?? c.split(/\s+/)[0];
  const base = program.split(/[\\/]/).pop() ?? '';
  return base || null;
}

export interface CodexConfigData {
  /** config.toml exists and was readable. */
  available: boolean;
  /** The active `profile = "<name>"`; its [profiles.<name>] values are already applied to the fields below. */
  profile: string | null;
  model: string | null;
  reasoningEffort: string | null;
  approvalPolicy: string | null;
  sandboxMode: string | null;
  personality: string | null;
  serviceTier: string | null;
  /** A turn-complete `notify` program is configured (the command itself is never read). */
  notify: boolean;
  plugins: { name: string; marketplace: string; enabled: boolean }[];
  marketplaces: string[];
  /** MCP servers by name, with only the basename of their launch command. */
  mcpServers: { name: string; command: string | null }[];
  /** `[projects.'<path>']` entries by trust level — counts only, no paths. */
  projects: { trusted: number; untrusted: number; total: number };
}

/** The allowlisted top-level string keys, each with the field it fills. */
const TOP_LEVEL = new Map<string, (o: CodexConfigData, v: string | null) => void>([
  ['model', (o, v) => void (o.model = v)],
  ['model_reasoning_effort', (o, v) => void (o.reasoningEffort = v)],
  ['approval_policy', (o, v) => void (o.approvalPolicy = v)],
  ['sandbox_mode', (o, v) => void (o.sandboxMode = v)],
  ['personality', (o, v) => void (o.personality = v)],
  ['service_tier', (o, v) => void (o.serviceTier = v)],
]);

export function emptyCodexConfig(available = false): CodexConfigData {
  return {
    available,
    profile: null,
    model: null,
    reasoningEffort: null,
    approvalPolicy: null,
    sandboxMode: null,
    personality: null,
    serviceTier: null,
    notify: false,
    plugins: [],
    marketplaces: [],
    mcpServers: [],
    projects: { trusted: 0, untrusted: 0, total: 0 },
  };
}

/** `documents@openai-primary-runtime` → name + marketplace (split at the LAST '@'). */
function splitPluginId(id: string): { name: string; marketplace: string } {
  const at = id.lastIndexOf('@');
  return at > 0 ? { name: id.slice(0, at), marketplace: id.slice(at + 1) } : { name: id, marketplace: '' };
}

/** Project the allowlisted fields out of config.toml text. Pure; never throws. */
export function projectCodexConfig(text: string): CodexConfigData {
  const out = emptyCodexConfig(true);
  const plugins = new Map<string, boolean>();
  const marketplaces = new Set<string>();
  const mcp = new Map<string, string | null>();
  const projects = new Map<string, string | null>();
  const profiles = new Map<string, Map<string, string | null>>();

  const touch = (path: string[]) => {
    const [root, name] = path;
    if (name === undefined || name === '[]') return;
    if (root === 'plugins' && !plugins.has(name)) plugins.set(name, true);
    else if (root === 'marketplaces') marketplaces.add(name);
    else if (root === 'mcp_servers' && !mcp.has(name)) mcp.set(name, null);
    else if (root === 'projects' && !projects.has(name)) projects.set(name, null);
  };

  scanToml(text, {
    table: touch,
    entry: (path, raw) => {
      if (path.length === 1) {
        const set = TOP_LEVEL.get(path[0]);
        if (set) set(out, tomlString(raw));
        else if (path[0] === 'profile') out.profile = tomlString(raw);
        else if (path[0] === 'notify') out.notify = raw.length > 0 && raw !== '[]' && raw !== '""';
        return;
      }
      touch(path);
      const [root, name, key, ...rest] = path;
      if (rest.length > 0) return;
      if (root === 'plugins' && key === 'enabled') {
        const b = tomlBool(raw);
        if (b !== null) plugins.set(name, b);
      } else if (root === 'mcp_servers' && key === 'command') {
        mcp.set(name, commandBasename(tomlString(raw)));
      } else if (root === 'mcp_servers' && key === undefined) {
        // `[mcp_servers]` + `name = { command = "…", … }` (inline-table form).
        mcp.set(name, commandBasename(inlineCommand(raw)));
      } else if (root === 'projects' && key === 'trust_level') {
        projects.set(name, tomlString(raw));
      } else if (root === 'profiles' && name !== '[]' && key !== undefined && TOP_LEVEL.has(key)) {
        const values = profiles.get(name) ?? new Map<string, string | null>();
        values.set(key, tomlString(raw));
        profiles.set(name, values);
      }
    },
  });

  // Codex's precedence: the selected profile's values win over the top-level ones.
  for (const [key, v] of (out.profile ? profiles.get(out.profile) : undefined) ?? []) {
    if (v !== null) TOP_LEVEL.get(key)?.(out, v);
  }

  out.plugins = [...plugins]
    .map(([id, enabled]) => ({ ...splitPluginId(id), enabled }))
    .sort((a, b) => a.name.localeCompare(b.name));
  out.marketplaces = [...marketplaces].sort();
  out.mcpServers = [...mcp].map(([name, command]) => ({ name, command })).sort((a, b) => a.name.localeCompare(b.name));
  let trusted = 0;
  for (const level of projects.values()) if (level === 'trusted') trusted++;
  out.projects = { trusted, untrusted: projects.size - trusted, total: projects.size };
  return out;
}

const TTL = 60_000;
let configCache: { at: number; dir: string; data: CodexConfigData } | null = null;

/** `<codexDir>/config.toml`, projected. Missing/unreadable → `available: false`. 60 s cache. */
export async function readCodexConfig(now = Date.now()): Promise<CodexConfigData> {
  const dir = codexDir();
  if (configCache && configCache.dir === dir && now - configCache.at < TTL) return configCache.data;
  let data: CodexConfigData;
  try {
    data = projectCodexConfig(await readFile(join(dir, 'config.toml'), 'utf8'));
  } catch {
    data = emptyCodexConfig(false);
  }
  configCache = { at: now, dir, data };
  return data;
}

export interface CodexAutomation {
  name: string;
  /** Human schedule, e.g. "Weekly · Sun 09:00". */
  schedule: string;
  /** 'active' | 'paused' | … (lower-cased), or '' when unset. */
  status: string;
}

const DAY_NAMES: Record<string, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };

/** RFC 5545 RRULE as a short label (e.g. `FREQ=WEEKLY;BYDAY=SU;BYHOUR=9` → "Weekly · Sun 09:00"); unknown shapes fall back to the rule text. */
export function describeRrule(rrule: string | null): string {
  if (!rrule) return 'unscheduled';
  const body = rrule.replace(/^RRULE:/i, '');
  const parts = new Map<string, string>();
  for (const p of body.split(';')) {
    const [k, v] = p.split('=');
    if (k && v) parts.set(k.toUpperCase(), v.toUpperCase());
  }
  const freq = parts.get('FREQ');
  const interval = Number(parts.get('INTERVAL') ?? '1');
  const unit: Record<string, string> = { MINUTELY: 'minute', HOURLY: 'hour', DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' };
  if (!freq || !unit[freq]) return body;
  const every =
    interval > 1 ? `Every ${interval} ${unit[freq]}s` : freq === 'DAILY' ? 'Daily' : `${freq[0]}${freq.slice(1).toLowerCase()}`;
  const days = (parts.get('BYDAY') ?? '')
    .split(',')
    .map((d) => DAY_NAMES[d.replace(/^[-+]?\d+/, '')])
    .filter(Boolean);
  const hour = parts.get('BYHOUR');
  const minute = parts.get('BYMINUTE') ?? '0';
  const time =
    hour !== undefined && /^\d+$/.test(hour) && /^\d+$/.test(minute)
      ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
      : '';
  const when = [days.join(', '), time].filter(Boolean).join(' ');
  return when ? `${every} · ${when}` : every;
}

/** Name, status and schedule from one automation.toml — `prompt` (free text) and thread ids are never decoded. */
export function projectAutomation(text: string, fallbackName: string): CodexAutomation {
  const f: { name?: string | null; status?: string | null; rrule?: string | null } = {};
  scanToml(text, {
    entry: (path, raw) => {
      if (path.length !== 1) return;
      const key = path[0];
      if (key === 'name' || key === 'status' || key === 'rrule') f[key] = tomlString(raw);
    },
  });
  return {
    name: (f.name ?? '').trim().slice(0, 80) || fallbackName,
    schedule: describeRrule(f.rrule ?? null),
    status: (f.status ?? '').toLowerCase(),
  };
}
