/**
 * ai.ts — model-call abstraction for AI Insights.
 *
 * Resolves a backend in priority order: ANTHROPIC_API_KEY (real billable key) →
 * local `claude -p` CLI (when on PATH) → the Claude.ai OAuth token from
 * .credentials.json (the same one the Live tab uses) → none. The app usually
 * runs in Docker, where the CLI is absent, so the API paths are the common case.
 *
 * Prompts are passed to the CLI via stdin (no shell, injection-safe, no temp
 * file — works with the read-only ~/.claude Docker mount).
 */

import { execFile, spawn } from 'node:child_process';
import { readCredentials, oauthHeaders } from './scan.ts';

export type AiProvider = 'claude' | 'openai' | 'gemini';
export type AiBackend = 'cli' | 'api' | 'apikey' | 'claude' | 'openai' | 'gemini' | 'none';

export interface AiStatus {
  available: AiBackend;
  model: string;
  reason?: string;
}

/** Per-request credentials from the client (Settings → AI Insights). */
export interface AiCreds {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

export interface AiCallInput {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}

export class AiUnavailableError extends Error {}
export class AiTokenRejectedError extends Error {}
export class AiCallError extends Error {}

const DEFAULT_MODEL = process.env.AI_MODEL || 'claude-opus-4-8';
const CALL_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60_000);
const MAX_OUTPUT_TOKENS = 1024;
const CLI_PROBE_TTL = 5 * 60_000;
const ANTHROPIC_VERSION = '2023-06-01';

// Honor Claude Code's own proxy/gateway env vars so AI Insights works against a
// corporate LiteLLM/gateway. ANTHROPIC_BASE_URL = proxy origin; ANTHROPIC_AUTH_TOKEN
// = its bearer token (sent as Authorization, matching Claude Code). Falls back to
// api.anthropic.com + x-api-key (ANTHROPIC_API_KEY) when unset.
function anthropicBaseUrl(): string {
  const raw = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').trim();
  return raw.replace(/\/+$/, '').replace(/\/v1$/, ''); // tolerate trailing slash and/or /v1
}
function messagesUrl(): string {
  return `${anthropicBaseUrl()}/v1/messages`;
}
/** Server-env credential for the Messages backend; proxy auth token wins over api key. */
function envApiHeaders(): Record<string, string> | null {
  const token = (process.env.ANTHROPIC_AUTH_TOKEN || '').trim();
  if (token) return { authorization: `Bearer ${token}` };
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (key) return { 'x-api-key': key };
  return null;
}

let cliProbe: { ok: boolean; at: number } | null = null;

// On Windows the `claude` command is a .cmd/.ps1 shim, which execFile cannot
// launch directly (it doesn't resolve PATHEXT). Route through `cmd /c` instead
// of shell:true — same effect, no DEP0190 arg-escaping warning.
function cliInvocation(args: string[]): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return { file: process.env.ComSpec || 'cmd.exe', args: ['/c', 'claude', ...args] };
  }
  return { file: 'claude', args };
}

/**
 * `claude --version` succeeds within a few seconds. Cached 5 min. Works on the
 * host and inside Docker when the image was built with WITH_CLAUDE_CLI=1; when
 * the CLI is absent the probe just fails fast (ENOENT) and caches false.
 */
export async function claudeCliAvailable(): Promise<boolean> {
  if (cliProbe && Date.now() - cliProbe.at < CLI_PROBE_TTL) return cliProbe.ok;
  const { file, args } = cliInvocation(['--version']);
  const ok = await new Promise<boolean>((resolve) => {
    execFile(file, args, { timeout: 4000, windowsHide: true }, (err) => resolve(!err));
  });
  cliProbe = { ok, at: Date.now() };
  return ok;
}

/** Decide which backend will serve a call right now. */
export async function resolveBackend(): Promise<AiStatus> {
  if (envApiHeaders()) return { available: 'apikey', model: DEFAULT_MODEL };
  if (await claudeCliAvailable()) return { available: 'cli', model: DEFAULT_MODEL };
  const creds = await readCredentials();
  const token = creds?.claudeAiOauth?.accessToken;
  const expiresAt = creds?.claudeAiOauth?.expiresAt;
  if (token && !(expiresAt && Date.now() >= expiresAt)) return { available: 'api', model: DEFAULT_MODEL };
  if (token && expiresAt && Date.now() >= expiresAt)
    return { available: 'none', model: DEFAULT_MODEL, reason: 'OAuth token expired — run any Claude Code command to refresh it.' };
  return { available: 'none', model: DEFAULT_MODEL, reason: 'No Claude CLI and no Claude.ai token found. Install Claude Code, or set ANTHROPIC_AUTH_TOKEN (+ ANTHROPIC_BASE_URL for a proxy) or ANTHROPIC_API_KEY.' };
}

export async function runAi(
  input: AiCallInput,
  creds?: AiCreds | null,
): Promise<{ text: string; backend: AiBackend }> {
  // User-supplied key from Settings takes precedence over every server fallback.
  if (creds && creds.apiKey && creds.provider) {
    return { text: await callProvider(creds, input), backend: creds.provider };
  }
  const status = await resolveBackend();
  const model = input.model || status.model;
  if (status.available === 'apikey') return { text: await runViaApiKey(input, model), backend: 'apikey' };
  if (status.available === 'cli') return { text: await runViaCli(input, model), backend: 'cli' };
  if (status.available === 'api') return { text: await runViaOAuth(input, model), backend: 'api' };
  throw new AiUnavailableError(status.reason || 'AI backend unavailable');
}

/** Route a user-configured request to the chosen provider. */
function callProvider(creds: AiCreds, input: AiCallInput): Promise<string> {
  const model = creds.model || DEFAULT_MODEL;
  if (creds.provider === 'openai') return callOpenAI(creds.apiKey, input, model);
  if (creds.provider === 'gemini') return callGemini(creds.apiKey, input, model);
  return callMessages({ 'x-api-key': creds.apiKey }, input, model); // claude
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function runViaCli(input: AiCallInput, model: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { file, args } = cliInvocation(['--print', '--model', model, '--output-format', 'text']);
    const child = execFile(
      file,
      args,
      { timeout: CALL_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) return reject(new AiCallError(`claude CLI failed: ${stderr || err.message}`));
        const out = String(stdout).trim();
        out ? resolve(out) : reject(new AiCallError('Empty CLI response'));
      },
    );
    // Prompt via stdin — never interpolated into a shell, so transcript-derived
    // text can't break out, and there's no arg-length cap or temp file.
    child.stdin?.end(`${input.system}\n\n${input.user}`);
  });
}

// ── Anthropic Messages API (shared) ───────────────────────────────────────────

async function callMessages(headers: Record<string, string>, input: AiCallInput, model: string): Promise<string> {
  const res = await fetch(messagesUrl(), {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json', 'anthropic-version': ANTHROPIC_VERSION },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens ?? MAX_OUTPUT_TOKENS,
      system: input.system,
      messages: [{ role: 'user', content: input.user }],
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403)
    throw new AiTokenRejectedError(`Anthropic API rejected the credential (${res.status}).`);
  if (!res.ok) throw new AiCallError(`Anthropic API error ${res.status} ${res.statusText} (model "${model}" via ${anthropicBaseUrl()})`);
  const data: any = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('').trim()
    : '';
  if (!text) throw new AiCallError('Empty response from model');
  return text;
}

function runViaApiKey(input: AiCallInput, model: string): Promise<string> {
  return callMessages(envApiHeaders()!, input, model);
}

// ── OpenAI ─────────────────────────────────────────────────────────────────

async function callOpenAI(apiKey: string, input: AiCallInput, model: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_completion_tokens: input.maxTokens ?? MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ],
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403)
    throw new AiTokenRejectedError(`OpenAI rejected the API key (${res.status}).`);
  if (!res.ok) throw new AiCallError(`OpenAI API error ${res.status} ${res.statusText}`);
  const data: any = await res.json();
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new AiCallError('Empty response from OpenAI');
  return text;
}

// ── Google Gemini ────────────────────────────────────────────────────────────

async function callGemini(apiKey: string, input: AiCallInput, model: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: 'user', parts: [{ text: input.user }] }],
      generationConfig: { maxOutputTokens: input.maxTokens ?? MAX_OUTPUT_TOKENS },
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403)
    throw new AiTokenRejectedError(`Gemini rejected the API key (${res.status}).`);
  if (!res.ok) throw new AiCallError(`Gemini API error ${res.status} ${res.statusText}`);
  const data: any = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: any) => p?.text ?? '').join('').trim() : '';
  if (!text) throw new AiCallError('Empty response from Gemini');
  return text;
}

async function runViaOAuth(input: AiCallInput, model: string): Promise<string> {
  const creds = await readCredentials();
  const token = creds?.claudeAiOauth?.accessToken;
  if (!token) throw new AiUnavailableError('No OAuth token');
  return callMessages(oauthHeaders(token), input, model);
}

// ── Streaming ────────────────────────────────────────────────────────────────
// Each backend streams text deltas via onDelta(chunk). The route forwards them
// to the client over a chunked text/plain response.

export interface AiStreamHandlers {
  onStart: (backend: AiBackend) => void;
  onDelta: (text: string) => void;
}

/** Read an SSE body line-by-line, parsing each `data:` JSON payload. */
async function pumpSSE(res: Response, onJson: (j: any) => void): Promise<void> {
  const body = res.body as ReadableStream<Uint8Array> | null;
  if (!body) return;
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        onJson(JSON.parse(data));
      } catch {
        /* ignore keep-alive / non-JSON lines */
      }
    }
  }
}

async function callMessagesStream(
  headers: Record<string, string>,
  input: AiCallInput,
  model: string,
  onDelta: (t: string) => void,
): Promise<void> {
  const res = await fetch(messagesUrl(), {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json', 'anthropic-version': ANTHROPIC_VERSION },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens ?? MAX_OUTPUT_TOKENS,
      system: input.system,
      messages: [{ role: 'user', content: input.user }],
      stream: true,
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403)
    throw new AiTokenRejectedError(`Anthropic API rejected the credential (${res.status}).`);
  if (!res.ok) throw new AiCallError(`Anthropic API error ${res.status} ${res.statusText} (model "${model}" via ${anthropicBaseUrl()})`);
  await pumpSSE(res, (j) => {
    if (j?.type === 'content_block_delta' && j.delta?.type === 'text_delta' && j.delta.text) onDelta(j.delta.text);
  });
}

async function callOpenAIStream(apiKey: string, input: AiCallInput, model: string, onDelta: (t: string) => void): Promise<void> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_completion_tokens: input.maxTokens ?? MAX_OUTPUT_TOKENS,
      stream: true,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ],
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403)
    throw new AiTokenRejectedError(`OpenAI rejected the API key (${res.status}).`);
  if (!res.ok) throw new AiCallError(`OpenAI API error ${res.status} ${res.statusText}`);
  await pumpSSE(res, (j) => {
    const t = j?.choices?.[0]?.delta?.content;
    if (typeof t === 'string' && t) onDelta(t);
  });
}

async function callGeminiStream(apiKey: string, input: AiCallInput, model: string, onDelta: (t: string) => void): Promise<void> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: 'user', parts: [{ text: input.user }] }],
      generationConfig: { maxOutputTokens: input.maxTokens ?? MAX_OUTPUT_TOKENS },
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403)
    throw new AiTokenRejectedError(`Gemini rejected the API key (${res.status}).`);
  if (!res.ok) throw new AiCallError(`Gemini API error ${res.status} ${res.statusText}`);
  await pumpSSE(res, (j) => {
    const parts = j?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const t = parts.map((p: any) => p?.text ?? '').join('');
      if (t) onDelta(t);
    }
  });
}

function runViaCliStream(input: AiCallInput, model: string, onDelta: (t: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const { file, args } = cliInvocation(['--print', '--model', model, '--output-format', 'text']);
    const child = spawn(file, args, { windowsHide: true });
    let any = false;
    let err = '';
    let settled = false;
    // Settle once and stop forwarding deltas afterwards: a killed child can still
    // flush a final stdout chunk, and writing it after the route has ended the
    // response would throw ERR_STREAM_WRITE_AFTER_END.
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(
      () =>
        settle(() => {
          child.kill();
          reject(new AiCallError('claude CLI timed out'));
        }),
      CALL_TIMEOUT_MS,
    );
    child.stdout.on('data', (d) => {
      if (settled) return;
      any = true;
      onDelta(d.toString());
    });
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('error', (e) => settle(() => reject(new AiCallError(`claude CLI failed: ${e.message}`))));
    child.on('close', (code) =>
      settle(() => {
        if (code !== 0 && !any) reject(new AiCallError(`claude CLI failed: ${err || `exit ${code}`}`));
        else resolve();
      }),
    );
    child.stdin.end(`${input.system}\n\n${input.user}`);
  });
}

function streamProvider(creds: AiCreds, input: AiCallInput, onDelta: (t: string) => void): Promise<void> {
  const model = creds.model || DEFAULT_MODEL;
  if (creds.provider === 'openai') return callOpenAIStream(creds.apiKey, input, model, onDelta);
  if (creds.provider === 'gemini') return callGeminiStream(creds.apiKey, input, model, onDelta);
  return callMessagesStream({ 'x-api-key': creds.apiKey }, input, model, onDelta);
}

export async function runAiStream(
  input: AiCallInput,
  creds: AiCreds | null | undefined,
  h: AiStreamHandlers,
): Promise<AiBackend> {
  if (creds && creds.apiKey && creds.provider) {
    h.onStart(creds.provider);
    await streamProvider(creds, input, h.onDelta);
    return creds.provider;
  }
  const status = await resolveBackend();
  const model = input.model || status.model;
  if (status.available === 'apikey') {
    h.onStart('apikey');
    await callMessagesStream(envApiHeaders()!, input, model, h.onDelta);
    return 'apikey';
  }
  if (status.available === 'cli') {
    h.onStart('cli');
    await runViaCliStream(input, model, h.onDelta);
    return 'cli';
  }
  if (status.available === 'api') {
    const cred = await readCredentials();
    const token = cred?.claudeAiOauth?.accessToken;
    if (!token) throw new AiUnavailableError('No OAuth token');
    h.onStart('api');
    await callMessagesStream(oauthHeaders(token), input, model, h.onDelta);
    return 'api';
  }
  throw new AiUnavailableError(status.reason || 'AI backend unavailable');
}
